-- Створити bucket для лекцій
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'lectures',
    'lectures',
    true,
    52428800, -- 50MB
    ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO NOTHING;

-- Видалити існуючі політики, якщо вони є
DROP POLICY IF EXISTS "Authenticated users can upload lectures" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view lectures" ON storage.objects;
DROP POLICY IF EXISTS "Owners can update their lectures" ON storage.objects;
DROP POLICY IF EXISTS "Owners can delete their lectures" ON storage.objects;

-- Політика: Автентифіковані користувачі можуть завантажувати лекції
CREATE POLICY "Authenticated users can upload lectures"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lectures');

-- Політика: Всі можуть переглядати лекції
CREATE POLICY "Anyone can view lectures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lectures');

-- Політика: Власники можуть оновлювати свої лекції
CREATE POLICY "Owners can update their lectures"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lectures' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Політика: Власники можуть видаляти свої лекції
CREATE POLICY "Owners can delete their lectures"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lectures' AND auth.uid()::text = (storage.foldername(name))[1]);
