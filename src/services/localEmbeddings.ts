/**
 * Локальна генерація embeddings без OpenAI
 * Використовує Transformers.js для запуску моделей на CPU
 * Безкоштовно, швидко, приватно
 */

import { pipeline, env } from '@xenova/transformers';

// Вимкнути локальне кешування моделей (опціонально)
// env.cacheDir = './models';

// Використовуємо легку багатомовну модель для embeddings
// Підтримує українську, англійську та інші мови
const MODEL_NAME = 'Xenova/multilingual-e5-small';

let embeddingPipeline: any = null;

/**
 * Ініціалізація pipeline для embeddings
 * Модель завантажується один раз при першому виклику
 */
async function getEmbeddingPipeline() {
    if (!embeddingPipeline) {
        console.log('[LocalEmbeddings] Завантаження моделі:', MODEL_NAME);
        console.log('[LocalEmbeddings] Це може зайняти 10-30 секунд при першому запуску...');

        embeddingPipeline = await pipeline('feature-extraction', MODEL_NAME);

        console.log('[LocalEmbeddings] Модель завантажена успішно!');
    }
    return embeddingPipeline;
}

/**
 * Генерує embedding вектор для тексту
 * @param text - Текст для embedding
 * @returns Масив чисел (вектор розміром 384)
 */
export async function generateLocalEmbedding(text: string): Promise<number[]> {
    try {
        const extractor = await getEmbeddingPipeline();

        // Обрізаємо текст до 512 токенів (обмеження моделі)
        const truncatedText = text.slice(0, 2000);

        // Генеруємо embedding
        const output = await extractor(truncatedText, { pooling: 'mean', normalize: true });

        // Конвертуємо тензор в масив
        const embedding = Array.from(output.data) as number[];

        return embedding;
    } catch (error) {
        console.error('[LocalEmbeddings] Помилка генерації embedding:', error);
        throw error;
    }
}

/**
 * Генерує embeddings для масиву текстів (batch processing)
 * Швидше ніж генерувати по одному
 */
export async function generateLocalEmbeddingsBatch(texts: string[]): Promise<number[][]> {
    try {
        const extractor = await getEmbeddingPipeline();

        // Обрізаємо кожен текст
        const truncatedTexts = texts.map(text => text.slice(0, 2000));

        console.log(`[LocalEmbeddings] Генерація ${texts.length} embeddings...`);

        // Batch processing
        const output = await extractor(truncatedTexts, { pooling: 'mean', normalize: true });

        // Конвертуємо в масив масивів
        const embeddings: number[][] = [];
        const embeddingSize = 384; // Розмір вектора для multilingual-e5-small

        for (let i = 0; i < texts.length; i++) {
            const start = i * embeddingSize;
            const end = start + embeddingSize;
            embeddings.push(Array.from(output.data.slice(start, end)));
        }

        console.log(`[LocalEmbeddings] Згенеровано ${embeddings.length} embeddings`);

        return embeddings;
    } catch (error) {
        console.error('[LocalEmbeddings] Помилка batch генерації:', error);
        throw error;
    }
}

/**
 * Обчислює cosine similarity між двома векторами
 * Використовується для пошуку схожого контенту
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
        throw new Error('Вектори мають різну довжину');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Тестова функція для перевірки роботи
 */
export async function testLocalEmbeddings() {
    console.log('[LocalEmbeddings] Запуск тесту...');

    const text1 = 'Штучний інтелект змінює світ';
    const text2 = 'AI трансформує наше життя';
    const text3 = 'Сьогодні гарна погода';

    const [emb1, emb2, emb3] = await generateLocalEmbeddingsBatch([text1, text2, text3]);

    const sim12 = cosineSimilarity(emb1, emb2);
    const sim13 = cosineSimilarity(emb1, emb3);

    console.log('[LocalEmbeddings] Схожість "AI" текстів:', sim12.toFixed(3));
    console.log('[LocalEmbeddings] Схожість "AI" vs "погода":', sim13.toFixed(3));
    console.log('[LocalEmbeddings] Тест пройдено! ✅');
}
