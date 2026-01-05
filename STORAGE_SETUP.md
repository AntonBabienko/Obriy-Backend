# Налаштування Supabase Storage

## Створення Storage Bucket для лекцій

Щоб завантажувати файли лекцій, потрібно створити storage bucket в Supabase.

### Варіант 1: Через Supabase Dashboard (рекомендовано)

1. Відкрийте ваш проект в [Supabase Dashboard](https://supabase.com/dashboard)
2. Перейдіть в розділ **Storage** в лівому меню
3. Натисніть **"New bucket"**
4. Введіть назву: `lectures`
5. Виберіть **Public bucket** (щоб файли були доступні для читання)
6. Натисніть **"Create bucket"**

### Варіант 2: Через SQL

Виконайте наступний SQL запит в SQL Editor вашого Supabase проекту:

```sql
-- Створити bucket для лекцій
INSERT INTO storage.buckets (id, name, public)
VALUES ('lectures', 'lectures', true);

-- Налаштувати політики доступу
CREATE POLICY "Authenticated users can upload lectures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lectures');

CREATE POLICY "Anyone can view lectures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lectures');

CREATE POLICY "Owners can update their lectures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lectures' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their lectures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lectures' AND auth.uid()::text = (storage.foldername(name))[1]);
```

### Перевірка

Після створення bucket, спробуйте завантажити лекцію через інтерфейс додатку. Файл має успішно завантажитися.

### Налаштування розміру файлів

За замовчуванням Supabase дозволяє файли до 50MB. Якщо потрібно більше:

1. Перейдіть в **Settings** → **Storage**
2. Змініть **File size limit**
3. Збережіть зміни

## Troubleshooting

### Помилка "Bucket not found"
- Переконайтеся, що bucket створено з назвою `lectures`
- Перевірте, що bucket є публічним (public = true)

### Помилка "Permission denied"
- Перевірте політики доступу (RLS policies)
- Переконайтеся, що користувач автентифікований

### Файли не відображаються
- Перевірте, що bucket є публічним
- Перевірте URL файлу в базі даних
- Перевірте політику SELECT для публічного доступу
