import { supabase } from '../config/supabase';
import { chunkText, sampleChunks } from './textChunker';
import { generateLocalEmbeddingsBatch, generateLocalEmbedding } from './localEmbeddings';

const MAX_CHUNKS = 150; // Максимум 150 чанків для дуже великих файлів
const BATCH_SIZE = 20; // Обробляємо по 20 чанків за раз (швидше!)

export async function generateEmbeddings(lectureId: string, content: string) {
    try {
        // Розбиваємо текст на чанки (3000 символів з overlap 500)
        const allChunks = chunkText(content, { chunkSize: 3000, overlap: 500 });
        console.log(`[Embeddings] Total chunks: ${allChunks.length} for lecture ${lectureId}`);

        // Використовуємо семплювання для дуже великих файлів
        const chunksToProcess = sampleChunks(allChunks, MAX_CHUNKS);
        console.log(`[Embeddings] Processing ${chunksToProcess.length} chunks (${content.length} chars total)`);

        let processedCount = 0;
        let errorCount = 0;

        // BATCH обробка чанків - швидше ніж по одному
        // Обробляємо по 10 чанків за раз для оптимальної швидкості
        for (let i = 0; i < chunksToProcess.length; i += BATCH_SIZE) {
            const batch = chunksToProcess.slice(i, i + BATCH_SIZE);
            const batchTexts = batch.map(chunk => chunk.text);

            try {
                // Генеруємо embeddings локально (безкоштовно!)
                const batchNum = Math.floor(i / BATCH_SIZE) + 1;
                const totalBatches = Math.ceil(chunksToProcess.length / BATCH_SIZE);
                console.log(`[Embeddings] Batch ${batchNum}/${totalBatches} (${batch.length} chunks)...`);

                const embeddings = await generateLocalEmbeddingsBatch(batchTexts);

                // Зберігаємо в БД
                const insertData = batch.map((chunk, idx) => ({
                    lecture_id: lectureId,
                    content_chunk: chunk.text,
                    chunk_index: chunk.index,
                    embedding: JSON.stringify(embeddings[idx])
                }));

                await supabase
                    .from('lecture_embeddings')
                    .insert(insertData);

                processedCount += batch.length;

                // Логування прогресу
                console.log(`[Embeddings] Progress: ${processedCount}/${chunksToProcess.length} chunks processed`);

                // Пауза для GC тільки кожні 50 чанків (менше пауз = швидше)
                if (processedCount % 50 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            } catch (chunkError) {
                errorCount += batch.length;
                console.error(`[Embeddings] Error processing batch:`, chunkError);

                // Якщо занадто багато помилок, зупиняємося
                if (errorCount > 10) {
                    console.error(`[Embeddings] Too many errors (${errorCount}), stopping processing`);
                    break;
                }
            }
        }

        // Оновлюємо статус обробки
        await supabase
            .from('lectures')
            .update({
                embeddings_generated: true,
                chunks_count: processedCount,
                processing_status: 'completed'
            })
            .eq('id', lectureId);

        console.log(`[Embeddings] Successfully generated embeddings for lecture ${lectureId}`);
        console.log(`[Embeddings] Stats: ${processedCount} processed, ${errorCount} errors`);
    } catch (error) {
        console.error('[Embeddings] Error generating embeddings:', error);

        // Позначаємо помилку в БД
        await supabase
            .from('lectures')
            .update({
                processing_status: 'failed',
                processing_error: error instanceof Error ? error.message : 'Unknown error'
            })
            .eq('id', lectureId);
    }
}

export async function searchSimilarContent(lectureId: string, query: string, limit: number = 5) {
    try {
        // Генеруємо embedding для запиту локально
        console.log(`[Embeddings] Пошук схожого контенту для: "${query.slice(0, 50)}..."`);
        const queryEmbedding = await generateLocalEmbedding(query);

        // Шукаємо схожі чанки (використовуючи cosine similarity)
        const { data, error } = await supabase.rpc('match_lecture_chunks', {
            query_embedding: queryEmbedding,
            lecture_id: lectureId,
            match_threshold: 0.7,
            match_count: limit
        });

        if (error) throw error;

        console.log(`[Embeddings] Знайдено ${data?.length || 0} схожих чанків`);
        return data;
    } catch (error) {
        console.error('[Embeddings] Помилка пошуку:', error);
        return [];
    }
}
