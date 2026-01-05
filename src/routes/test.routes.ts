import { Router } from 'express';
import { supabase } from '../config/supabase';
import { getGeminiModel, rotateGeminiKey, hasMoreGeminiKeys } from '../config/gemini';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { aiCacheService } from '../services/aiCache';
import { contentHashService } from '../services/contentHash';

const router = Router();

// Create test (teacher only)
router.post('/', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const {
            courseId,
            lectureId,
            title,
            description,
            duration,
            deadline,
            maxAttempts,
            groupId,
            questions,
            isAiGenerated,
            generationTopics,
            questionsPerStudent,
            generationPrompt
        } = req.body;

        // Create test
        const { data: test, error: testError } = await supabase
            .from('tests')
            .insert({
                course_id: courseId,
                lecture_id: lectureId,
                title,
                description,
                duration,
                deadline,
                max_attempts: maxAttempts,
                test_type: 'official',
                group_id: groupId,
                created_by: user.id,
                is_ai_generated: isAiGenerated || false,
                generation_topics: generationTopics || null,
                questions_per_student: questionsPerStudent || 10,
                generation_prompt: generationPrompt || null
            })
            .select()
            .single();

        if (testError) throw testError;

        // Якщо це НЕ AI-генерований тест, створюємо питання зараз
        if (!isAiGenerated && questions && questions.length > 0) {
            for (let i = 0; i < questions.length; i++) {
                const q = questions[i];

                const { data: question, error: qError } = await supabase
                    .from('questions')
                    .insert({
                        test_id: test.id,
                        question_text: q.questionText,
                        question_type: q.questionType,
                        points: q.points,
                        explanation: q.explanation,
                        order_index: i
                    })
                    .select()
                    .single();

                if (qError) throw qError;

                // Create answer options
                for (let j = 0; j < q.options.length; j++) {
                    const opt = q.options[j];

                    await supabase
                        .from('answer_options')
                        .insert({
                            question_id: question.id,
                            option_text: opt.optionText,
                            is_correct: opt.isCorrect,
                            order_index: j
                        });
                }
            }
        }

        res.status(201).json(test);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Generate test with AI (teacher only)
router.post('/generate', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { lectureIds, questionsCount = 10, forceRefresh = false } = req.body;

        if (!lectureIds || !Array.isArray(lectureIds) || lectureIds.length === 0) {
            return res.status(400).json({ message: 'Потрібно вказати хоча б одну лекцію' });
        }

        // Fetch all selected lectures
        const { data: lectures, error: lecturesError } = await supabase
            .from('lectures')
            .select('content, title, id, embeddings_generated')
            .in('id', lectureIds);

        if (lecturesError || !lectures || lectures.length === 0) {
            return res.status(404).json({ message: 'Лекції не знайдено' });
        }

        // Try to get content from database first
        let combinedContent = lectures
            .map(l => l.content)
            .filter(c => c && c.trim().length > 0)
            .join('\n\n---\n\n');

        // Log content for debugging
        console.log('[Test Routes] Generating questions from lectures:', lectures.map(l => ({
            title: l.title,
            contentLength: l.content?.length || 0,
            hasEmbeddings: l.embeddings_generated
        })));

        // If no content in database, try to get from embeddings
        if (!combinedContent || combinedContent.trim().length === 0) {
            console.log('[Test Routes] No content in database, trying to fetch from embeddings...');

            const embeddingsContent: string[] = [];
            for (const lecture of lectures) {
                if (lecture.embeddings_generated) {
                    // Fetch all chunks for this lecture
                    const { data: chunks } = await supabase
                        .from('lecture_embeddings')
                        .select('content_chunk')
                        .eq('lecture_id', lecture.id)
                        .order('id', { ascending: true });

                    if (chunks && chunks.length > 0) {
                        const lectureContent = chunks.map(c => c.content_chunk).join(' ');
                        embeddingsContent.push(lectureContent);
                        console.log(`[Test Routes] Fetched ${chunks.length} chunks for lecture ${lecture.title}`);
                    }
                }
            }

            if (embeddingsContent.length > 0) {
                combinedContent = embeddingsContent.join('\n\n---\n\n');
            }
        }

        console.log('[Test Routes] Combined content length:', combinedContent.length);
        console.log('[Test Routes] Combined content preview:', combinedContent.substring(0, 500));

        if (!combinedContent || combinedContent.trim().length === 0) {
            return res.status(400).json({
                message: 'Лекції не містять текстового контенту. Переконайтеся, що лекції були оброблені системою.'
            });
        }

        // Generate content hash for cache key
        const contentHash = contentHashService.generateHash(combinedContent);
        console.log('[Test Routes] Content hash:', contentHash);

        // Generate cache key
        const cacheKey = aiCacheService.generateCacheKey({
            operationType: 'test_generation',
            lectureIds,
            params: { questionsCount },
            contentHash
        });
        console.log('[Test Routes] Cache key:', cacheKey);

        // Check cache (unless forceRefresh is true)
        if (!forceRefresh) {
            const cached = await aiCacheService.getCachedResponse(cacheKey);
            if (cached) {
                console.log('✅ CACHE HIT - Returning cached response', {
                    cacheKey,
                    operationType: 'test_generation',
                    lectureIds,
                    tokensSaved: cached.tokens_used,
                    cachedAt: cached.created_at
                });
                return res.json({
                    questions: cached.response_data,
                    cached: true,
                    cachedAt: cached.created_at,
                    tokensSaved: cached.tokens_used
                });
            }
            console.log('❌ CACHE MISS - Calling Gemini API', {
                cacheKey,
                operationType: 'test_generation',
                lectureIds,
                willCallAPI: true
            });
        } else {
            console.log('🔄 FORCE REFRESH - Bypassing cache', {
                cacheKey,
                operationType: 'test_generation',
                lectureIds
            });
        }

        // CRITICAL: Gemini Free Tier has 1M TPM (Tokens Per Minute) limit
        // 1 Token ≈ 4 Characters, so 1M tokens ≈ 4M characters
        // Safe limit: 3.8M chars (~950k tokens) to avoid 429 Resource Exhausted errors
        const MAX_SAFE_CHARS = 3_800_000;
        const estimatedTokens = Math.floor(combinedContent.length / 4);

        console.log(`📊 [Test Routes] Content analysis:`);
        console.log(`   - Characters: ${combinedContent.length.toLocaleString()}`);
        console.log(`   - Estimated tokens: ~${estimatedTokens.toLocaleString()}`);
        console.log(`   - Limit: ${MAX_SAFE_CHARS.toLocaleString()} chars (~950k tokens)`);

        if (combinedContent.length > MAX_SAFE_CHARS) {
            const percentageLost = Math.round((1 - MAX_SAFE_CHARS / combinedContent.length) * 100);
            console.warn(`⚠️  Content exceeds safe limit!`);
            console.warn(`⚠️  Truncating to ${MAX_SAFE_CHARS.toLocaleString()} chars (${percentageLost}% of content will be lost)`);
            combinedContent = combinedContent.substring(0, MAX_SAFE_CHARS);
        } else {
            const percentageUsed = Math.round((combinedContent.length / MAX_SAFE_CHARS) * 100);
            console.log(`✅ Content fits within limit (${percentageUsed}% of available space)`);
        }

        const prompt = `Створи ${questionsCount} тестових питань з множинним вибором на основі наданого матеріалу.

ВАЖЛИВО:
- Формулюй питання на основі ЗМІСТУ матеріалу, а не його назви
- НЕ використовуй назви курсів, лекцій або файлів у питаннях
- Зосередься на фактах, концепціях та знаннях з матеріалу
- Кожне питання має 4 варіанти відповіді, з яких тільки один правильний
- Додай коротке пояснення до кожного питання

Відповідай ТІЛЬКИ у форматі JSON без додаткового тексту: {"questions": [{"questionText": "...", "questionType": "multiple_choice", "points": 1, "explanation": "...", "options": [{"optionText": "...", "isCorrect": true/false}]}]}

МАТЕРІАЛ:
${combinedContent}`;

        console.log('\n========== AI REQUEST (Gemini) ==========');
        console.log('Content length:', combinedContent.length, 'chars');
        console.log('Questions to generate:', questionsCount);
        console.log('=========================================\n');

        // Retry logic with API key rotation for rate limiting
        let result;
        let retries = 0;
        const maxRetries = 3;

        while (retries < maxRetries) {
            try {
                const model = getGeminiModel();
                result = await model.generateContent(prompt);
                break; // Success - exit loop
            } catch (error: any) {
                if (error.message?.includes('429')) {
                    // Rate limit hit - try rotating to next API key
                    if (hasMoreGeminiKeys() && retries < maxRetries - 1) {
                        console.log(`⚠️  Rate limit hit on current API key`);
                        rotateGeminiKey();
                        console.log(`🔄 Switched to next API key, retrying immediately...`);
                        retries++;
                        continue; // Try immediately with new key
                    }

                    // No more keys or last retry - wait and retry with same key
                    if (retries < maxRetries - 1) {
                        const retryMatch = error.message.match(/retry in ([\d.]+)s/i);
                        let waitTime = Math.pow(2, retries) * 10000; // Default: 10s, 20s, 40s

                        if (retryMatch) {
                            const suggestedWait = Math.ceil(parseFloat(retryMatch[1]));
                            waitTime = (suggestedWait + 5) * 1000; // Add 5 seconds buffer
                            console.log(`⏳ No more API keys. Waiting ${suggestedWait + 5}s (API suggested ${suggestedWait}s)...`);
                        } else {
                            console.log(`⏳ No more API keys. Waiting ${waitTime / 1000}s before retry...`);
                        }

                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        retries++;
                    } else {
                        throw error; // Max retries reached
                    }
                } else {
                    throw error; // Not a rate limit error
                }
            }
        }

        const response = result!.response;
        const text = response.text();

        console.log('\n========== AI RESPONSE ==========');
        console.log('Response preview:', text.substring(0, 500));
        console.log('=================================\n');

        // Extract JSON from response (Gemini might wrap it in markdown)
        let jsonText = text.trim();
        if (jsonText.startsWith('```json')) {
            jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (jsonText.startsWith('```')) {
            jsonText = jsonText.replace(/```\n?/g, '');
        }

        const parsedResult = JSON.parse(jsonText);
        const questions = parsedResult.questions || [];

        // Estimate tokens used (rough estimate: 1 token ≈ 4 characters)
        const responseTokens = Math.floor((combinedContent.length + text.length) / 4);

        // Store response in cache
        await aiCacheService.cacheResponse(
            cacheKey,
            'test_generation',
            lectureIds,
            { questionsCount },
            contentHash,
            questions,
            responseTokens,
            combinedContent.length
        );

        console.log('💾 CACHE STORED', {
            cacheKey,
            operationType: 'test_generation',
            tokensUsed: responseTokens,
            contentSize: combinedContent.length
        });

        res.json({
            questions,
            cached: false,
            tokensUsed: responseTokens
        });
    } catch (error: any) {
        console.error('[Test Routes] Error generating questions:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get tests by course (for both teacher and student)
router.get('/course/:courseId', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { courseId } = req.params;
        const { role } = req.query;

        if (role === 'teacher') {
            // Teacher: get all tests for this course
            const { data: tests, error } = await supabase
                .from('tests')
                .select(`
                    *,
                    questions (id),
                    test_submissions (
                        id,
                        student_id,
                        score,
                        percentage,
                        submitted_at
                    )
                `)
                .eq('course_id', courseId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data for teacher view
            const transformedTests = tests?.map(test => {
                const submissionsCount = test.test_submissions?.length || 0;
                const completedSubmissions = test.test_submissions?.filter((sub: any) => sub.submitted_at !== null).length || 0;

                return {
                    ...test,
                    questionsCount: test.questions?.length || 0,
                    submissionsCount,
                    averageScore: submissionsCount > 0
                        ? test.test_submissions.reduce((sum: number, sub: any) => sum + (sub.percentage || 0), 0) / submissionsCount
                        : 0,
                    completionRate: submissionsCount > 0
                        ? (completedSubmissions / submissionsCount) * 100
                        : 0
                };
            }) || [];

            res.json(transformedTests);
        } else {
            // Student: get tests for this course with their submissions
            const { data: tests, error } = await supabase
                .from('tests')
                .select(`
                    *,
                    test_submissions (
                        id,
                        student_id,
                        score,
                        percentage,
                        attempt_number,
                        submitted_at
                    )
                `)
                .eq('course_id', courseId)
                .order('deadline', { ascending: true });

            if (error) throw error;

            // Filter submissions to only include current student's
            const transformedTests = tests?.map(test => ({
                ...test,
                test_submissions: test.test_submissions?.filter((sub: any) => sub.student_id === user.id) || []
            })) || [];

            res.json(transformedTests);
        }
    } catch (error: any) {
        console.error('[Test Routes] Error fetching tests by course:', error);
        res.status(500).json({ message: error.message });
    }
});

// Get tests for student
router.get('/student', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;

        // Get student's groups
        const { data: memberships } = await supabase
            .from('group_members')
            .select('group_id')
            .eq('student_id', user.id);

        const groupIds = memberships?.map(m => m.group_id) || [];

        // Get tests for these groups
        const { data: tests } = await supabase
            .from('tests')
            .select(`
        *,
        course:courses (title),
        test_submissions (
          id,
          score,
          percentage,
          attempt_number,
          submitted_at
        )
      `)
            .in('group_id', groupIds)
            .order('deadline', { ascending: true });

        res.json(tests);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Start test
router.post('/:testId/start', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { testId } = req.params;

        // Check attempts
        const { count } = await supabase
            .from('test_submissions')
            .select('*', { count: 'exact', head: true })
            .eq('test_id', testId)
            .eq('student_id', user.id);

        const { data: test } = await supabase
            .from('tests')
            .select('*')
            .eq('id', testId)
            .single();

        if (!test) {
            return res.status(404).json({ message: 'Тест не знайдено' });
        }

        if (count && count >= test.max_attempts) {
            return res.status(400).json({ message: 'Вичерпано всі спроби' });
        }

        // Create submission
        const { data: submission, error } = await supabase
            .from('test_submissions')
            .insert({
                test_id: testId,
                student_id: user.id,
                attempt_number: (count || 0) + 1
            })
            .select()
            .single();

        if (error) throw error;

        let questions;

        // Якщо це AI-генерований тест
        if (test.is_ai_generated) {
            // Перевіряємо чи вже є згенерований варіант для цього студента
            const { data: existingVariant } = await supabase
                .from('student_test_variants')
                .select('questions_data')
                .eq('test_id', testId)
                .eq('student_id', user.id)
                .single();

            if (existingVariant) {
                // Використовуємо існуючий варіант
                questions = existingVariant.questions_data;
            } else {
                // Генеруємо новий варіант
                console.log('[Test Routes] Generating AI test for student:', user.id);

                const topics = test.generation_topics || [];
                const questionsCount = test.questions_per_student || 10;
                const additionalPrompt = test.generation_prompt || '';

                const prompt = `Створи ${questionsCount} тестових питань з множинним вибором на основі наступних тем: ${topics.join(', ')}.

${additionalPrompt ? `Додаткові інструкції: ${additionalPrompt}\n` : ''}
ВАЖЛИВО:
- Кожне питання має 4 варіанти відповіді
- Тільки один варіант правильний
- Питання мають бути різноманітними та охоплювати різні аспекти тем
- Додай коротке пояснення до кожного питання
- Кожне питання коштує 10 балів

Відповідай ТІЛЬКИ у форматі JSON: {"questions": [{"questionText": "...", "questionType": "multiple_choice", "points": 10, "explanation": "...", "options": [{"optionText": "...", "isCorrect": true/false}]}]}

Згенеруй унікальний варіант тесту для студента. Теми: ${topics.join(', ')}`;

                const model = getGeminiModel();
                const geminiResult = await model.generateContent({
                    contents: [{ role: 'user', parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.9, // Висока температура для більшої унікальності
                    }
                });

                const response = geminiResult.response;
                let text = response.text();

                // Extract JSON from response
                if (text.startsWith('```json')) {
                    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');
                } else if (text.startsWith('```')) {
                    text = text.replace(/```\n?/g, '');
                }

                const result = JSON.parse(text);
                questions = result.questions || [];

                // Зберігаємо згенерований варіант
                await supabase
                    .from('student_test_variants')
                    .insert({
                        test_id: testId,
                        student_id: user.id,
                        questions_data: questions
                    });

                console.log('[Test Routes] Generated and saved', questions.length, 'questions');
            }
        } else {
            // Звичайний тест - отримуємо питання з БД
            const { data: dbQuestions } = await supabase
                .from('questions')
                .select(`
                    *,
                    answer_options (*)
                `)
                .eq('test_id', testId)
                .order('order_index');

            questions = dbQuestions;
        }

        res.json({ submission, questions });
    } catch (error: any) {
        console.error('[Test Routes] Error starting test:', error);
        res.status(500).json({ message: error.message });
    }
});

// Submit test
router.post('/:testId/submit', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { testId } = req.params;
        const { submissionId, answers } = req.body;

        let totalScore = 0;
        let maxScore = 0;

        // Process answers
        for (const answer of answers) {
            const { data: question } = await supabase
                .from('questions')
                .select('points')
                .eq('id', answer.questionId)
                .single();

            const { data: option } = await supabase
                .from('answer_options')
                .select('is_correct')
                .eq('id', answer.selectedOptionId)
                .single();

            maxScore += question?.points || 0;
            const isCorrect = option?.is_correct || false;

            if (isCorrect) {
                totalScore += question?.points || 0;
            }

            // Save answer
            await supabase
                .from('student_answers')
                .insert({
                    submission_id: submissionId,
                    question_id: answer.questionId,
                    selected_option_id: answer.selectedOptionId,
                    is_correct: isCorrect
                });
        }

        // Update submission
        const percentage = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;

        const { data: submission, error } = await supabase
            .from('test_submissions')
            .update({
                submitted_at: new Date().toISOString(),
                score: totalScore,
                max_score: maxScore,
                percentage
            })
            .eq('id', submissionId)
            .select()
            .single();

        if (error) throw error;
        res.json(submission);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get test results
router.get('/:testId/results/:submissionId', authenticate, async (req, res) => {
    try {
        const { testId, submissionId } = req.params;

        const { data: submission } = await supabase
            .from('test_submissions')
            .select('*')
            .eq('id', submissionId)
            .single();

        const { data: answers } = await supabase
            .from('student_answers')
            .select(`
        *,
        question:questions (*),
        selected_option:answer_options (*)
      `)
            .eq('submission_id', submissionId);

        res.json({ submission, answers });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
