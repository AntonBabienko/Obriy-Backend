import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import { supabase } from '../config/supabase';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { processLectureFile } from '../services/fileProcessor';
import { generateEmbeddings } from '../services/embeddings';
import { contentHashService } from '../services/contentHash';
import { aiCacheService } from '../services/aiCache';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Get lectures for a course
router.get('/course/:courseId', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('lectures')
            .select('*')
            .eq('course_id', req.params.courseId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get single lecture
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('lectures')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(404).json({ message: 'Лекцію не знайдено' });
    }
});

// Get lecture file content
router.get('/:id/file', authenticate, async (req, res) => {
    try {
        const { data: lecture, error } = await supabase
            .from('lectures')
            .select('file_url, file_type, file_name, content')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        if (!lecture) {
            return res.status(404).json({ message: 'Лекцію не знайдено' });
        }

        // If there's a file URL, return it for download
        if (lecture.file_url) {
            res.json({
                fileUrl: lecture.file_url,
                fileType: lecture.file_type,
                fileName: lecture.file_name,
                content: lecture.content
            });
        } else {
            // Return just the content
            res.json({
                content: lecture.content || ''
            });
        }
    } catch (error: any) {
        console.error('[Lecture File] Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Upload lecture (teacher only)
router.post('/', authenticate, authorize('teacher'), upload.single('file'), async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { courseId, title, content } = req.body;
        const file = req.file;

        console.log('[Lecture Upload] Starting upload...', { courseId, title, hasFile: !!file });

        let fileUrl = null;
        let fileType = null;
        let fileName = null;
        let fileSize = 0;
        let extractedContent = content || '';

        // Upload file to Supabase Storage if provided
        if (file) {
            const fs = require('fs');
            const fileExt = file.originalname.split('.').pop();
            const filePath = `${user.id}/${Date.now()}.${fileExt}`;

            console.log('[Lecture Upload] Reading file...', file.path);
            const fileBuffer = fs.readFileSync(file.path);
            fileSize = fileBuffer.length;

            console.log('[Lecture Upload] Uploading to Supabase...', { filePath, size: fileSize });
            const { error: uploadError } = await supabase.storage
                .from('lectures')
                .upload(filePath, fileBuffer, {
                    contentType: file.mimetype
                });

            if (uploadError) {
                console.error('[Lecture Upload] Upload error:', uploadError);
                throw uploadError;
            }

            const { data: { publicUrl } } = supabase.storage
                .from('lectures')
                .getPublicUrl(filePath);

            fileUrl = publicUrl;
            fileType = file.mimetype;
            fileName = file.originalname;

            console.log('[Lecture Upload] File uploaded successfully');

            // Extract text from file BEFORE deleting it
            console.log('[Lecture Upload] Extracting text from file...');
            extractedContent = await processLectureFile(file.path, file.mimetype);
            console.log('[Lecture Upload] Extracted content length:', extractedContent.length);

            // Clean up temp file
            fs.unlinkSync(file.path);
        }

        // Create lecture
        console.log('[Lecture Upload] Creating lecture record...');
        const { data: lecture, error } = await supabase
            .from('lectures')
            .insert({
                course_id: courseId,
                title,
                content: extractedContent,
                file_url: fileUrl,
                file_type: fileType,
                file_name: fileName,
                file_size_bytes: fileSize,
                uploaded_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('[Lecture Upload] Database error:', error);
            throw error;
        }

        console.log('[Lecture Upload] Lecture created successfully:', lecture.id);

        // Initialize content hash for new lecture
        if (extractedContent && extractedContent.length > 0) {
            const contentHash = contentHashService.generateHash(extractedContent);
            await contentHashService.updateLectureHash(lecture.id, contentHash);
            console.log('[Lecture Upload] Content hash initialized');
        }

        // Відразу повертаємо відповідь користувачу
        res.status(201).json(lecture);

        // Generate embeddings in background (оптимізовано з chunking)
        if (extractedContent && extractedContent.length > 0) {
            console.log('[Lecture Upload] Starting embeddings generation in background...');
            setImmediate(() => {
                generateEmbeddings(lecture.id, extractedContent).catch((err) => {
                    console.error('[Lecture Upload] Error generating embeddings:', err);
                });
            });
        } else {
            console.log('[Lecture Upload] No content to generate embeddings from');
        }
    } catch (error: any) {
        console.error('[Lecture Upload] Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Update lecture metadata
router.put('/:id', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { title, description, content } = req.body;
        const updateData: any = {};

        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (content !== undefined) updateData.content = content;

        // If content is being updated, handle cache invalidation
        if (content !== undefined) {
            console.log('[Lecture Update] Content update detected, checking for changes...');

            // Get the current stored hash
            const storedHash = await contentHashService.getLectureHash(req.params.id);

            // Calculate new content hash
            const newContentHash = contentHashService.generateHash(content);

            // Compare hashes
            if (storedHash && storedHash !== newContentHash) {
                console.log('[Lecture Update] Content changed, invalidating cache...');

                // Invalidate cache entries with mismatched content hash
                const deletedCount = await aiCacheService.invalidateByContentHash(
                    req.params.id,
                    newContentHash
                );

                console.log(`[Lecture Update] Invalidated ${deletedCount} cache entries`);
            }

            // Update the stored content hash
            await contentHashService.updateLectureHash(req.params.id, newContentHash);
            console.log('[Lecture Update] Content hash updated');
        }

        const { data: lecture, error } = await supabase
            .from('lectures')
            .update(updateData)
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;

        if (!lecture) {
            return res.status(404).json({ message: 'Лекцію не знайдено' });
        }

        res.json(lecture);
    } catch (error: any) {
        console.error('[Lecture Update] Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete lecture
router.delete('/:id', authenticate, authorize('teacher'), async (req, res) => {
    try {
        console.log('[Lecture Delete] Deleting lecture:', req.params.id);

        // Invalidate cache before deletion
        console.log('[Lecture Delete] Invalidating cache entries...');
        const deletedCacheCount = await aiCacheService.invalidateLectureCache(req.params.id);
        console.log(`[Lecture Delete] Invalidated ${deletedCacheCount} cache entries`);

        // Delete the lecture (cascade will handle lecture_content_hashes)
        const { error } = await supabase
            .from('lectures')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        console.log('[Lecture Delete] Lecture deleted successfully');
        res.json({ message: 'Лекцію видалено' });
    } catch (error: any) {
        console.error('[Lecture Delete] Error:', error);
        res.status(500).json({ message: error.message });
    }
});

// Reprocess lecture (extract content from file)
router.post('/:id/reprocess', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { id } = req.params;

        // Get lecture
        const { data: lecture, error: lectureError } = await supabase
            .from('lectures')
            .select('*')
            .eq('id', id)
            .single();

        if (lectureError || !lecture) {
            return res.status(404).json({ message: 'Лекцію не знайдено' });
        }

        if (!lecture.file_url) {
            return res.status(400).json({ message: 'Лекція не має файлу' });
        }

        console.log('[Lecture Reprocess] Downloading file from:', lecture.file_url);

        // Download file from Supabase
        const response = await fetch(lecture.file_url);
        if (!response.ok) {
            throw new Error('Failed to download file');
        }

        const buffer = await response.arrayBuffer();
        const tempPath = `./temp_${Date.now()}_${lecture.file_name}`;
        fs.writeFileSync(tempPath, Buffer.from(buffer));

        console.log('[Lecture Reprocess] Extracting text...');
        const extractedContent = await processLectureFile(tempPath, lecture.file_type);
        console.log('[Lecture Reprocess] Extracted content length:', extractedContent.length);

        // Clean up temp file
        fs.unlinkSync(tempPath);

        // Calculate new content hash
        const newContentHash = contentHashService.generateHash(extractedContent);

        // Get stored hash and invalidate cache if content changed
        const storedHash = await contentHashService.getLectureHash(id);
        if (storedHash && storedHash !== newContentHash) {
            console.log('[Lecture Reprocess] Content changed, invalidating cache...');
            const deletedCount = await aiCacheService.invalidateByContentHash(id, newContentHash);
            console.log(`[Lecture Reprocess] Invalidated ${deletedCount} cache entries`);
        }

        // Update lecture with extracted content
        const { error: updateError } = await supabase
            .from('lectures')
            .update({ content: extractedContent })
            .eq('id', id);

        if (updateError) throw updateError;

        // Update the stored content hash
        await contentHashService.updateLectureHash(id, newContentHash);
        console.log('[Lecture Reprocess] Content hash updated');

        // Generate embeddings
        if (extractedContent && extractedContent.length > 0) {
            console.log('[Lecture Reprocess] Generating embeddings...');
            await generateEmbeddings(id, extractedContent);
        }

        res.json({ message: 'Лекцію успішно оброблено', contentLength: extractedContent.length });
    } catch (error: any) {
        console.error('[Lecture Reprocess] Error:', error);
        res.status(500).json({ message: error.message });
    }
});

export default router;
