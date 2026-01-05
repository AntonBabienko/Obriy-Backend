/**
 * Розбиття тексту на чанки для embeddings
 * OpenAI text-embedding-3-small приймає max 8192 токени
 * Використовуємо чанки по 3000 символів (~750 токенів) з overlap 500 символів
 */

export interface TextChunk {
    text: string;
    index: number;
    startChar: number;
    endChar: number;
    estimatedTokens: number;
}

export interface ChunkOptions {
    chunkSize?: number;    // Розмір чанку в символах (default: 3000)
    overlap?: number;      // Overlap між чанками (default: 500)
}

const DEFAULT_CHUNK_SIZE = 3000;
const DEFAULT_OVERLAP = 500;

/**
 * Розбиває текст на чанки з overlap
 */
export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
    const overlap = options.overlap || DEFAULT_OVERLAP;

    console.log(`[TextChunker] Chunking text: ${text.length} chars`);
    console.log(`[TextChunker] Chunk size: ${chunkSize}, Overlap: ${overlap}`);

    const chunks: TextChunk[] = [];
    let startChar = 0;
    let index = 0;

    while (startChar < text.length) {
        const endChar = Math.min(startChar + chunkSize, text.length);
        const chunkText = text.slice(startChar, endChar);

        // Приблизна оцінка токенів: 1 токен ≈ 4 символи для англійської
        // Для української може бути трохи більше, але це безпечна оцінка
        const estimatedTokens = Math.ceil(chunkText.length / 4);

        chunks.push({
            text: chunkText,
            index,
            startChar,
            endChar,
            estimatedTokens,
        });

        // Переміщуємося вперед з урахуванням overlap
        startChar += chunkSize - overlap;
        index++;
    }

    console.log(`[TextChunker] Created ${chunks.length} chunks`);
    console.log(`[TextChunker] Avg tokens per chunk: ${Math.round(chunks.reduce((sum, c) => sum + c.estimatedTokens, 0) / chunks.length)}`);

    return chunks;
}

/**
 * Розумне семплювання чанків для дуже великих файлів
 * Бере початок, середину та кінець документу
 */
export function sampleChunks(chunks: TextChunk[], maxChunks: number): TextChunk[] {
    if (chunks.length <= maxChunks) {
        return chunks;
    }

    console.log(`[TextChunker] Sampling ${maxChunks} chunks from ${chunks.length} total`);

    const sampledChunks: TextChunk[] = [];
    const step = Math.floor(chunks.length / maxChunks);

    for (let i = 0; i < chunks.length; i += step) {
        sampledChunks.push(chunks[i]);
        if (sampledChunks.length >= maxChunks) break;
    }

    console.log(`[TextChunker] Sampled ${sampledChunks.length} chunks`);

    return sampledChunks;
}
