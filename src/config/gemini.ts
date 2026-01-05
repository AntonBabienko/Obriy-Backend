import { GoogleGenerativeAI } from '@google/generative-ai';

// Система ротації API ключів для обходу лімітів Free Tier
class GeminiKeyRotator {
    private keys: string[] = [];
    private currentIndex: number = 0;
    private clients: Map<string, GoogleGenerativeAI> = new Map();

    constructor() {
        // Завантажуємо всі доступні ключі з .env
        const key1 = process.env.GEMINI_API_KEY;
        const key2 = process.env.GEMINI_API_KEY_2;
        const key3 = process.env.GEMINI_API_KEY_3;
        const key4 = process.env.GEMINI_API_KEY_4;
        const key5 = process.env.GEMINI_API_KEY_5;
        const key6 = process.env.GEMINI_API_KEY_6;

        if (key1) this.keys.push(key1);
        if (key2) this.keys.push(key2);
        if (key3) this.keys.push(key3);
        if (key4) this.keys.push(key4);
        if (key5) this.keys.push(key5);
        if (key6) this.keys.push(key6);

        if (this.keys.length === 0) {
            console.warn('⚠️  No GEMINI_API_KEY found in environment variables');
        } else {
            console.log(`✅ Loaded ${this.keys.length} Gemini API key(s)`);
        }

        // Створюємо клієнти для кожного ключа
        this.keys.forEach((key, index) => {
            this.clients.set(key, new GoogleGenerativeAI(key));
        });
    }

    // Отримати поточний клієнт
    getCurrentClient(): GoogleGenerativeAI {
        if (this.keys.length === 0) {
            throw new Error('No Gemini API keys available');
        }
        const key = this.keys[this.currentIndex];
        return this.clients.get(key)!;
    }

    // Отримати номер поточного ключа
    getCurrentKeyNumber(): number {
        return this.currentIndex + 1;
    }

    // Отримати загальну кількість ключів
    getTotalKeys(): number {
        return this.keys.length;
    }

    // Переключитись на наступний ключ
    rotateToNext(): void {
        if (this.keys.length <= 1) {
            console.warn('⚠️  Only one API key available, cannot rotate');
            return;
        }

        const oldIndex = this.currentIndex;
        this.currentIndex = (this.currentIndex + 1) % this.keys.length;

        console.log(`🔄 Rotated API key: ${oldIndex + 1} → ${this.currentIndex + 1} (of ${this.keys.length})`);
    }

    // Перевірити чи є ще ключі для ротації
    hasMoreKeys(): boolean {
        return this.keys.length > 1;
    }

    // Почати з останнього ключа (найсвіжішого)
    startFromLastKey(): void {
        if (this.keys.length > 1) {
            this.currentIndex = this.keys.length - 1;
            console.log(`🔑 Starting from API key ${this.currentIndex + 1} (last/freshest)`);
        }
    }
}

// Глобальний екземпляр ротатора
const keyRotator = new GeminiKeyRotator();

// Функція для отримання моделі
// gemini-2.5-flash: 1M токенів контексту, найновіша модель
// Переваги: краща якість відповідей, швидша генерація
export function getGeminiModel(useFlash = true) {
    const modelName = useFlash ? 'gemini-2.5-flash' : 'gemini-pro';
    const client = keyRotator.getCurrentClient();

    console.log(`[Gemini] Using model: ${modelName} (API key ${keyRotator.getCurrentKeyNumber()}/${keyRotator.getTotalKeys()})`);

    return client.getGenerativeModel({
        model: modelName,
        generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 8192,
        },
    });
}

// Функція для ротації ключа при rate limit
export function rotateGeminiKey(): void {
    keyRotator.rotateToNext();
}

// Функція для перевірки чи є ще ключі
export function hasMoreGeminiKeys(): boolean {
    return keyRotator.hasMoreKeys();
}
