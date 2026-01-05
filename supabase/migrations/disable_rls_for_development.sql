-- ТИМЧАСОВЕ ВІДКЛЮЧЕННЯ RLS ДЛЯ РОЗРОБКИ
-- ⚠️ УВАГА: Використовуйте тільки для розробки, НЕ для продакшену!

-- Відключаємо RLS для основних таблиць
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments DISABLE ROW LEVEL SECURITY;

-- Також відключаємо для інших таблиць, якщо вони існують
ALTER TABLE lectures DISABLE ROW LEVEL SECURITY;
ALTER TABLE tests DISABLE ROW LEVEL SECURITY;
ALTER TABLE questions DISABLE ROW LEVEL SECURITY;
ALTER TABLE test_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress DISABLE ROW LEVEL SECURITY;

-- Виводимо повідомлення
DO $$
BEGIN
    RAISE NOTICE '⚠️  RLS ВІДКЛЮЧЕНО ДЛЯ РОЗРОБКИ!';
    RAISE NOTICE '🔓 Всі таблиці тепер доступні без обмежень';
    RAISE NOTICE '⚡ Це дозволить backend працювати без помилок RLS';
    RAISE NOTICE '';
    RAISE NOTICE '📝 Не забудьте увімкнути RLS перед продакшеном:';
    RAISE NOTICE '   ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;';
END $$;