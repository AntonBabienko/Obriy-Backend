-- ДІАГНОСТИКА RLS ПРОБЛЕМ
-- Виконайте цей скрипт для перевірки стану RLS

-- Перевіряємо стан RLS для таблиць
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled,
    CASE 
        WHEN rowsecurity THEN '🔐 Увімкнено'
        ELSE '🔓 Відключено'
    END as status
FROM pg_tables 
WHERE tablename IN ('profiles', 'courses', 'course_enrollments')
ORDER BY tablename;

-- Перевіряємо існуючі політики
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    CASE 
        WHEN cmd = 'r' THEN 'SELECT'
        WHEN cmd = 'a' THEN 'INSERT'
        WHEN cmd = 'w' THEN 'UPDATE'
        WHEN cmd = 'd' THEN 'DELETE'
        WHEN cmd = '*' THEN 'ALL'
        ELSE cmd::text
    END as operation
FROM pg_policies 
WHERE tablename IN ('profiles', 'courses', 'course_enrollments')
ORDER BY tablename, policyname;

-- Перевіряємо поточного користувача
SELECT 
    current_user as current_db_user,
    session_user as session_db_user,
    COALESCE(auth.uid()::text, 'NULL') as auth_uid,
    CASE 
        WHEN auth.uid() IS NULL THEN '🔑 Service Role'
        ELSE '👤 Authenticated User'
    END as user_type;

-- Перевіряємо JWT claims (якщо доступні)
SELECT 
    COALESCE(
        current_setting('request.jwt.claims', true)::json->>'role',
        'No JWT claims'
    ) as jwt_role,
    COALESCE(
        current_setting('request.jwt.claims', true)::json->>'sub',
        'No JWT subject'
    ) as jwt_subject;

-- Тестуємо функцію is_service_role (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_service_role') THEN
        RAISE NOTICE 'is_service_role() = %', is_service_role();
    ELSE
        RAISE NOTICE 'Функція is_service_role() не існує';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Помилка при виклику is_service_role(): %', SQLERRM;
END $$;

-- Виводимо рекомендації
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 РЕКОМЕНДАЦІЇ:';
    RAISE NOTICE '';
    RAISE NOTICE '1. Якщо RLS відключено - це нормально для розробки';
    RAISE NOTICE '2. Якщо auth.uid() = NULL - ви використовуєте service key ✅';
    RAISE NOTICE '3. Якщо auth.uid() не NULL - перевірте конфігурацію backend';
    RAISE NOTICE '4. Якщо політики відсутні - виконайте міграції';
    RAISE NOTICE '';
    RAISE NOTICE '🔧 ДЛЯ ШВИДКОГО ВИПРАВЛЕННЯ:';
    RAISE NOTICE '   Виконайте: disable_rls_for_development.sql';
    RAISE NOTICE '';
END $$;