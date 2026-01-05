# Швидкий старт Backend

## Крок 1: Встановлення

```bash
cd backend
npm install
```

## Крок 2: Налаштування Supabase

### 2.1 Створення проєкту
1. Перейдіть на [supabase.com](https://supabase.com)
2. Створіть новий проєкт
3. Дочекайтесь завершення ініціалізації

### 2.2 Увімкнення pgvector (для RAG)
1. Перейдіть в Database → Extensions
2. Знайдіть `vector` та увімкніть його
3. Якщо `vector` недоступний, використайте `schema-simple.sql` замість `schema.sql`

### 2.3 Виконання SQL схеми
1. Відкрийте SQL Editor в Supabase Dashboard
2. Скопіюйте вміст файлу `supabase/schema.sql` (або `schema-simple.sql` якщо pgvector недоступний)
3. Виконайте SQL запит

### 2.4 Створення Storage bucket
1. Перейдіть в Storage
2. Створіть новий bucket з назвою `lectures`
3. Зробіть його публічним (Public bucket)

### 2.5 Отримання ключів
1. Перейдіть в Settings → API
2. Скопіюйте:
   - Project URL
   - anon/public key
   - service_role key (секретний!)

## Крок 3: Налаштування OpenAI

1. Перейдіть на [platform.openai.com](https://platform.openai.com)
2. Створіть API ключ
3. Переконайтесь, що у вас є кредити

## Крок 4: Конфігурація .env

Створіть файл `.env`:

```env
PORT=8080
NODE_ENV=development

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...

OPENAI_API_KEY=sk-...

CORS_ORIGIN=http://localhost:5173
```

## Крок 5: Запуск

```bash
npm run dev
```

Сервер запуститься на `http://localhost:8080`

## Крок 6: Тестування

### Перевірка здоров'я
```bash
curl http://localhost:8080/health
```

### Реєстрація викладача
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Іван",
    "lastName": "Петренко",
    "userName": "teacher1",
    "email": "teacher@example.com",
    "password": "password123",
    "role": "teacher",
    "sex": "male"
  }'
```

### Реєстрація студента
```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Марія",
    "lastName": "Іваненко",
    "userName": "student1",
    "email": "student@example.com",
    "password": "password123",
    "role": "student",
    "sex": "female"
  }'
```

### Вхід
```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "teacher@example.com",
    "password": "password123"
  }'
```

Збережіть отриманий `token` для наступних запитів.

### Створення курсу (викладач)
```bash
curl -X POST http://localhost:8080/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Основи філософії",
    "description": "Вступний курс"
  }'
```

### Завантаження лекції (викладач)
```bash
curl -X POST http://localhost:8080/api/lectures \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@lecture.pdf" \
  -F "courseId=COURSE_ID" \
  -F "title=Лекція 1"
```

### Генерація карточок пам'яті
```bash
curl -X POST http://localhost:8080/api/ai/flashcards/LECTURE_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Чат з AI про лекцію
```bash
curl -X POST http://localhost:8080/api/ai/chat/LECTURE_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Поясни основні концепції цієї лекції"
  }'
```

## Troubleshooting

### Помилка підключення до Supabase
- Перевірте правильність URL та ключів
- Переконайтесь, що проєкт активний

### Помилка OpenAI API
- Перевірте ключ
- Переконайтесь, що у вас є кредити
- Перевірте rate limits

### Помилка завантаження файлів
- Перевірте, що bucket `lectures` створений
- Перевірте, що bucket публічний
- Перевірте розмір файлу (макс 50MB)

## Наступні кроки

1. Інтегруйте з frontend
2. Додайте більше студентів та груп
3. Створіть тести
4. Експериментуйте з AI функціями
