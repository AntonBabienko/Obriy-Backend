import fs from 'fs';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';
import { cleanExtractedText } from './textCleaner';

export async function processLectureFile(filePath: string, mimeType: string): Promise<string> {
    const startTime = Date.now();
    const startMem = process.memoryUsage().heapUsed;

    try {
        console.log(`[FileProcessor] Processing ${mimeType} file: ${filePath}`);
        console.log(`[FileProcessor] Initial memory: ${(startMem / 1024 / 1024).toFixed(2)} MB`);

        let text = '';

        if (mimeType === 'application/pdf') {
            const dataBuffer = fs.readFileSync(filePath);
            const fileSize = dataBuffer.length;
            console.log(`[FileProcessor] PDF file size: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

            // Обмеження: максимум 10MB для PDF
            if (fileSize > 10 * 1024 * 1024) {
                throw new Error('PDF file too large (max 10MB)');
            }

            try {
                const data = await pdf(dataBuffer);
                text = data.text;

                // Перевіряємо якість витягнутого тексту
                const corruptedCharsRatio = (text.match(/[^\u0000-\u007F\u0400-\u04FF\u0100-\u017F\u1E00-\u1EFF\s\d\p{P}]/gu) || []).length / text.length;

                if (corruptedCharsRatio > 0.3) {
                    console.warn(`[FileProcessor] High ratio of corrupted characters detected: ${(corruptedCharsRatio * 100).toFixed(1)}%`);
                    // Можна спробувати альтернативний метод витягування або повідомити користувача
                }

                console.log(`[FileProcessor] Extracted ${text.length} characters from PDF (corrupted ratio: ${(corruptedCharsRatio * 100).toFixed(1)}%)`);
            } catch (pdfError) {
                console.error('[FileProcessor] PDF parsing failed:', pdfError);
                text = 'Помилка обробки PDF файлу. Можливо, файл пошкоджений або має проблеми з кодуванням.';
            }

            // Очищаємо буфер з пам'яті
            dataBuffer.fill(0);
        }
        else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            const result = await mammoth.extractRawText({ path: filePath });
            text = result.value;
            console.log(`[FileProcessor] Extracted ${text.length} characters from DOCX`);
        }
        else if (mimeType === 'text/plain') {
            text = fs.readFileSync(filePath, 'utf-8');
            console.log(`[FileProcessor] Read ${text.length} characters from TXT`);
        }

        const endTime = Date.now();
        const endMem = process.memoryUsage().heapUsed;
        const memDelta = (endMem - startMem) / 1024 / 1024;

        console.log(`[FileProcessor] Processing took ${endTime - startTime}ms`);
        console.log(`[FileProcessor] Memory delta: ${memDelta.toFixed(2)} MB`);
        console.log(`[FileProcessor] Current heap: ${(endMem / 1024 / 1024).toFixed(2)} MB`);

        // Очищаємо текст за допомогою textCleaner
        // Видаляє null bytes, контрольні символи, зайві пробіли, дублікати
        const cleanText = cleanExtractedText(text);

        // Форсуємо garbage collection якщо доступно
        if (global.gc) {
            console.log('[FileProcessor] Running garbage collection...');
            global.gc();
            const afterGC = process.memoryUsage().heapUsed;
            console.log(`[FileProcessor] After GC: ${(afterGC / 1024 / 1024).toFixed(2)} MB`);
        }

        return cleanText;
    } catch (error) {
        console.error('[FileProcessor] Error processing file:', error);
        return '';
    }
}
