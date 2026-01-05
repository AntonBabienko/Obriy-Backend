# Обрій - Backend

Бекенд частина навчальної платформи «Обрій» з AI інструментами.

## Технічний стек
- Node.js + Express + TypeScript
- Supabase для бази даних
- AI: **Gemini 2.5 Flash** (1M токенів контексту)
- Система кешування AI відповідей

## Встановлення

```bash
npm install
```

## Налаштування

1. Скопіюйте `.env.example` в `.env`
2. Заповніть змінні середовища:
   - `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2`, `GEMINI_API_KEY_3` - API ключі Gemini
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY` - налаштування Supabase

## Запуск

```bash
npm run dev
```

Сервер запуститься на `http://localhost:3001`

## AI Endpoints

- `POST /api/ai/summary/:lectureId` - конспект
- `POST /api/ai/generate-test/:lectureId` - тести
- `POST /api/ai/flashcards/:lectureId` - картки
- `POST /api/ai/mindmap/:lectureId` - ментальна карта
- `POST /api/ai/chat/:lectureId` - Q&A чат
- `POST /api/ai/ukrainian-educational/:lectureId` - укр. освітній контент

## Структура проекту

- `src/routes/` - API маршрути
- `src/services/` - бізнес логіка
- `src/config/` - конфігурація (Gemini, Supabase)
- `src/middleware/` - middleware функції
- `supabase/migrations/` - міграції бази даних

## Тестування

```bash
npm test
```