# Obriy Backend API

Backend API для навчальної платформи «Обрій» з Supabase та AI інтеграцією.

## Технології

- **Node.js + Express** - веб-сервер
- **TypeScript** - типізація
- **Supabase** - база даних та автентифікація
- **OpenAI GPT-4** - AI генерація контенту
- **RAG (Retrieval-Augmented Generation)** - пошук по лекціях
- **Multer** - завантаження файлів
- **pdf-parse, mammoth** - обробка PDF та DOCX

## Функціонал

### Для викладачів:
- ✅ Створення курсів та груп студентів
- ✅ Завантаження лекцій (PDF, DOCX, TXT)
- ✅ Створення тестів вручну або через AI
- ✅ Перегляд статистики студентів
- ✅ Аналіз успішності групи

### Для студентів:
- ✅ Перегляд лекцій
- ✅ AI генерація карточок пам'яті
- ✅ AI генерація тренувальних тестів
- ✅ Чат з AI про лекцію (RAG)
- ✅ Генерація mind map
- ✅ Генерація конспектів
- ✅ Проходження тестів
- ✅ Перегляд своєї успішності

## Встановлення

```bash
cd backend
npm install
```

## Налаштування Supabase

1. Створіть проєкт на [supabase.com](https://supabase.com)
2. Виконайте SQL з файлу `supabase/schema.sql` в SQL Editor
3. Створіть Storage bucket з назвою `lectures` (public)
4. Скопіюйте URL та ключі в `.env`

## Налаштування OpenAI

1. Отримайте API ключ на [platform.openai.com](https://platform.openai.com)
2. Додайте в `.env`

## Конфігурація

Створіть `.env`:

```env
PORT=8080
NODE_ENV=development

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-...

# CORS
CORS_ORIGIN=http://localhost:5173
```

## Запуск

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### Authentication
- `POST /auth/register` - Реєстрація
- `POST /auth/login` - Вхід

### Courses
- `GET /api/courses` - Список курсів
- `POST /api/courses` - Створити курс (teacher)

### Lectures
- `GET /api/lectures/course/:courseId` - Лекції курсу
- `POST /api/lectures` - Завантажити лекцію (teacher)
- `DELETE /api/lectures/:id` - Видалити лекцію (teacher)

### Tests
- `POST /api/tests` - Створити тест (teacher)
- `POST /api/tests/generate` - Згенерувати тест AI (teacher)
- `GET /api/tests/student` - Тести студента
- `POST /api/tests/:id/start` - Почати тест
- `POST /api/tests/:id/submit` - Здати тест
- `GET /api/tests/:id/results/:submissionId` - Результати

### AI Features
- `POST /api/ai/flashcards/:lectureId` - Генерувати карточки
- `GET /api/ai/flashcards/:lectureId` - Отримати карточки
- `POST /api/ai/generate-test/:lectureId` - Тренувальний тест
- `POST /api/ai/chat/:lectureId` - Чат з AI (RAG)
- `POST /api/ai/mindmap/:lectureId` - Mind map
- `POST /api/ai/summary/:lectureId` - Конспект

### Groups
- `POST /api/groups` - Створити групу (teacher)
- `GET /api/groups` - Групи викладача
- `POST /api/groups/:id/members` - Додати студента
- `DELETE /api/groups/:id/members/:studentId` - Видалити студента

### Statistics
- `GET /api/stats/teacher` - Статистика викладача
- `GET /api/stats/students/:id` - Статистика студента
- `GET /api/stats/student/me` - Моя статистика
- `GET /api/stats/group/:id` - Статистика групи

## Структура БД

```
profiles - профілі користувачів
groups - групи студентів
group_members - члени груп
courses - курси
lectures - лекції
lecture_embeddings - векторні embeddings для RAG
flashcards - карточки пам'яті
tests - тести
questions - питання тестів
answer_options - варіанти відповідей
test_submissions - здачі тестів
student_answers - відповіді студентів
student_progress - прогрес студентів
chat_messages - історія чату з AI
```

## Безпека

- Row Level Security (RLS) увімкнено для всіх таблиць
- JWT автентифікація через Supabase
- Розділення ролей teacher/student
- Файли зберігаються в Supabase Storage

## TODO

- [ ] Додати rate limiting
- [ ] Кешування AI відповідей
- [ ] Webhook для real-time оновлень
- [ ] Експорт статистики в CSV
- [ ] Email нотифікації
- [ ] Підтримка більше форматів файлів
