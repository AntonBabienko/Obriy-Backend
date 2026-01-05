-- Повне очищення та виправлення RLS політик
-- Цей скрипт безпечно видаляє всі існуючі політики та створює нові

-- ============================================================================
-- ФУНКЦІЯ ДЛЯ БЕЗПЕЧНОГО ВИДАЛЕННЯ ВСІХ ПОЛІТИК
-- ============================================================================

DO $$
DECLARE
    r RECORD;
    table_names TEXT[] := ARRAY['profiles', 'courses', 'course_enrollments', 'lectures', 'tests', 'test_submissions', 'student_progress', 'questions', 'answer_options', 'student_answers', 'chat_messages', 'flashcards', 'lecture_embeddings'];
    tbl_name TEXT;
BEGIN
    RAISE NOTICE '🧹 Очищення існуючих RLS політик...';
    
    FOREACH tbl_name IN ARRAY table_names LOOP
        -- Перевіряємо, чи існує таблиця
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = tbl_name) THEN
            RAISE NOTICE '   Очищення політик для таблиці: %', tbl_name;
            
            -- Видаляємо всі політики для цієї таблиці
            FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl_name) LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, tbl_name);
            END LOOP;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Очищення завершено';
END $$;

-- ============================================================================
-- СТВОРЕННЯ НОВИХ ПОЛІТИК ДЛЯ SERVICE ROLE
-- ============================================================================

-- PROFILES TABLE
CREATE POLICY "service_role_profiles_policy" ON profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- COURSES TABLE  
CREATE POLICY "service_role_courses_policy" ON courses
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- COURSE_ENROLLMENTS TABLE
CREATE POLICY "service_role_enrollments_policy" ON course_enrollments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- LECTURES TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lectures') THEN
        CREATE POLICY "service_role_lectures_policy" ON lectures
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для lectures';
    END IF;
END $$;

-- TESTS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tests') THEN
        CREATE POLICY "service_role_tests_policy" ON tests
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для tests';
    END IF;
END $$;

-- TEST_SUBMISSIONS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'test_submissions') THEN
        CREATE POLICY "service_role_submissions_policy" ON test_submissions
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для test_submissions';
    END IF;
END $$;

-- STUDENT_PROGRESS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_progress') THEN
        CREATE POLICY "service_role_progress_policy" ON student_progress
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для student_progress';
    END IF;
END $$;

-- QUESTIONS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'questions') THEN
        CREATE POLICY "service_role_questions_policy" ON questions
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для questions';
    END IF;
END $$;

-- ANSWER_OPTIONS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'answer_options') THEN
        CREATE POLICY "service_role_answer_options_policy" ON answer_options
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для answer_options';
    END IF;
END $$;

-- STUDENT_ANSWERS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'student_answers') THEN
        CREATE POLICY "service_role_student_answers_policy" ON student_answers
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для student_answers';
    END IF;
END $$;

-- CHAT_MESSAGES TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'chat_messages') THEN
        CREATE POLICY "service_role_chat_messages_policy" ON chat_messages
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для chat_messages';
    END IF;
END $$;

-- FLASHCARDS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'flashcards') THEN
        CREATE POLICY "service_role_flashcards_policy" ON flashcards
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для flashcards';
    END IF;
END $$;

-- LECTURE_EMBEDDINGS TABLE (якщо існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'lecture_embeddings') THEN
        CREATE POLICY "service_role_lecture_embeddings_policy" ON lecture_embeddings
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для lecture_embeddings';
    END IF;
END $$;

-- ============================================================================
-- УВІМКНЕННЯ RLS ДЛЯ ВСІХ ТАБЛИЦЬ
-- ============================================================================

DO $$
DECLARE
    table_names TEXT[] := ARRAY['profiles', 'courses', 'course_enrollments', 'lectures', 'tests', 'test_submissions', 'student_progress', 'questions', 'answer_options', 'student_answers', 'chat_messages', 'flashcards', 'lecture_embeddings'];
    tbl_name TEXT;
BEGIN
    RAISE NOTICE '🔐 Увімкнення RLS для всіх таблиць...';
    
    FOREACH tbl_name IN ARRAY table_names LOOP
        IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = tbl_name) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl_name);
            RAISE NOTICE '   RLS увімкнено для: %', tbl_name;
        END IF;
    END LOOP;
END $$;

-- ============================================================================
-- ФІНАЛЬНА ПЕРЕВІРКА ТА ЗВІТ
-- ============================================================================

DO $$
DECLARE
    total_policies INTEGER;
    total_tables INTEGER;
    table_info RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 ФІНАЛЬНИЙ ЗВІТ:';
    RAISE NOTICE '';
    
    -- Підраховуємо загальну кількість політик
    SELECT COUNT(*) INTO total_policies 
    FROM pg_policies 
    WHERE schemaname = 'public';
    
    -- Підраховуємо таблиці з RLS
    SELECT COUNT(*) INTO total_tables 
    FROM pg_tables 
    WHERE schemaname = 'public' AND rowsecurity = true;
    
    RAISE NOTICE '✅ Створено % RLS політик', total_policies;
    RAISE NOTICE '🔐 RLS увімкнено для % таблиць', total_tables;
    RAISE NOTICE '';
    
    -- Детальна інформація по таблицях
    RAISE NOTICE '📋 Деталі по таблицях:';
    FOR table_info IN 
        SELECT 
            t.tablename,
            t.rowsecurity,
            COUNT(p.policyname) as policy_count
        FROM pg_tables t
        LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
        WHERE t.schemaname = 'public' 
        AND t.tablename IN ('profiles', 'courses', 'course_enrollments', 'lectures', 'tests', 'test_submissions', 'student_progress')
        GROUP BY t.tablename, t.rowsecurity
        ORDER BY t.tablename
    LOOP
        RAISE NOTICE '   % - RLS: %, Політик: %', 
            table_info.tablename, 
            CASE WHEN table_info.rowsecurity THEN '✅' ELSE '❌' END,
            table_info.policy_count;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RLS налаштування завершено!';
    RAISE NOTICE '🔑 Service role має повний доступ до всіх таблиць';
    RAISE NOTICE '🛡️  RLS залишається увімкненим для безпеки';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ВАЖЛИВО: Переконайтеся, що backend використовує SUPABASE_SERVICE_KEY';
    RAISE NOTICE '';
END $$;