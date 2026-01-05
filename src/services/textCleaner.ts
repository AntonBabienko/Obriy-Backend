/**
 * Очищення витягнутого тексту з PDF/DOCX файлів
 * Видаляє дублікати, зайві пробіли, контрольні символи
 */

export function cleanExtractedText(text: string): string {
    console.log(`[TextCleaner] Starting cleaning, input length: ${text.length}`);

    let cleaned = text;

    // 1. Видалити null bytes та контрольні символи
    cleaned = cleaned.replace(/\u0000/g, '');
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

    // 2. Видалити пошкоджені символи кодування (як у вашому прикладі)
    // Видаляємо символи типу ®, ±, ¥, ¤, ¡, º, ¿, ̈, ̄, ³, ², ¼, §, £, ª та інші
    cleaned = cleaned.replace(/[®±¥¤¡º¿̈̄³²¼§£ª°¶µ¢¬­¯¨©«»¹¾½¼]/g, '');

    // Видаляємо комбінації пошкоджених символів
    cleaned = cleaned.replace(/[^\u0000-\u007F\u0400-\u04FF\u0100-\u017F\u1E00-\u1EFF\s\d\p{P}]/gu, '');

    // Видаляємо рядки, що складаються переважно з пошкоджених символів
    cleaned = cleaned.split('\n')
        .filter(line => {
            // Перевіряємо, чи рядок містить принаймні 50% нормальних символів
            const normalChars = line.match(/[a-zA-Zа-яіїєґА-ЯІЇЄҐ0-9\s]/g);
            const normalRatio = normalChars ? normalChars.length / line.length : 0;
            return normalRatio > 0.5 || line.length < 10;
        })
        .join('\n');

    // 3. Нормалізувати пробіли
    cleaned = cleaned.replace(/[ \t]+/g, ' '); // Множинні пробіли → один
    cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n'); // Множинні переноси → подвійний

    // 4. Trim кожного рядка (видаляє пробіли на початку/кінці рядків)
    cleaned = cleaned.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0) // Видаляємо порожні рядки
        .join('\n');

    // 5. Видалити дуже короткі рядки (ймовірно артефакти)
    // Залишаємо тільки рядки довші за 3 символи
    cleaned = cleaned.split('\n')
        .filter(line => line.length > 3)
        .join('\n');

    // 6. Фінальний trim
    cleaned = cleaned.trim();

    const reduction = ((text.length - cleaned.length) / text.length * 100).toFixed(1);
    console.log(`[TextCleaner] Cleaning complete:`);
    console.log(`[TextCleaner]   Original: ${text.length} chars`);
    console.log(`[TextCleaner]   Cleaned: ${cleaned.length} chars`);
    console.log(`[TextCleaner]   Reduction: ${reduction}%`);

    return cleaned;
}
