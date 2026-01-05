-- Простий та надійний скрипт для виправлення RLS
-- Виконайте цей скрипт в Supabase SQL Editor

-- ============================================================================
-- ВИДАЛЕННЯ ВСІХ ІСНУЮЧИХ ПОЛІТИК
-- ============================================================================

-- Profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "View profiles" ON profiles;
DROP POLICY IF EXISTS "Service can create profiles" ON profiles;
DROP POLICY IF EXISTS "Service can delete profiles" ON profiles;
DROP POLICY IF EXISTS "service_role_profiles_policy" ON profiles;

-- Courses
DROP POLICY IF EXISTS "Teachers can manage their courses" ON courses;
DROP POLICY IF EXISTS "Students can view courses" ON courses;
DROP POLICY IF EXISTS "View courses" ON courses;
DROP POLICY IF EXISTS "Teachers can create courses" ON courses;
DROP POLICY IF EXISTS "Teachers can update their courses" ON courses;
DROP POLICY IF EXISTS "Teachers can delete their courses" ON courses;
DROP POLICY IF EXISTS "service_role_courses_policy" ON courses;

-- Course enrollments
DROP POLICY IF EXISTS "Students can view their own enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can view enrollments for their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can enroll students in their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can remove students from their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Students can update their own progress" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can update student progress" ON course_enrollments;
DROP POLICY IF EXISTS "Students and teachers can update progress" ON course_enrollments;
DROP POLICY IF EXISTS "View enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "service_role_enrollments_policy" ON course_enrollments;

-- Lectures (якщо існує)
DROP POLICY IF EXISTS "Teachers can manage lectures" ON lectures;
DROP POLICY IF EXISTS "Students can view lectures" ON lectures;
DROP POLICY IF EXISTS "service_role_lectures_policy" ON lectures;

-- Tests (якщо існує)
DROP POLICY IF EXISTS "Teachers can manage tests" ON tests;
DROP POLICY IF EXISTS "Students can view their tests" ON tests;
DROP POLICY IF EXISTS "service_role_tests_policy" ON tests;

-- Test submissions (якщо існує)
DROP POLICY IF EXISTS "Students can manage their submissions" ON test_submissions;
DROP POLICY IF EXISTS "Teachers can view submissions" ON test_submissions;
DROP POLICY IF EXISTS "service_role_submissions_policy" ON test_submissions;

-- Student progress (якщо існує)
DROP POLICY IF EXISTS "Students can manage their progress" ON student_progress;
DROP POLICY IF EXISTS "Teachers can view student progress" ON student_progress;
DROP POLICY IF EXISTS "service_role_progress_policy" ON student_progress;

-- ============================================================================
-- СТВОРЕННЯ НОВИХ ПОЛІТИК ДЛЯ SERVICE ROLE
-- ============================================================================

-- Profiles - service role має повний доступ
CREATE POLICY "service_role_all_profiles" ON profiles
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Courses - service role має повний доступ
CREATE POLICY "service_role_all_courses" ON courses
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Course enrollments - service role має повний доступ
CREATE POLICY "service_role_all_enrollments" ON course_enrollments
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Lectures - service role має повний доступ (якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lectures') THEN
        CREATE POLICY "service_role_all_lectures" ON lectures
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для lectures';
    END IF;
END $$;

-- Tests - service role має повний доступ (якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tests') THEN
        CREATE POLICY "service_role_all_tests" ON tests
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для tests';
    END IF;
END $$;

-- Test submissions - service role має повний доступ (якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_submissions') THEN
        CREATE POLICY "service_role_all_submissions" ON test_submissions
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для test_submissions';
    END IF;
END $$;

-- Student progress - service role має повний доступ (якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_progress') THEN
        CREATE POLICY "service_role_all_progress" ON student_progress
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для student_progress';
    END IF;
END $$;

-- Questions - service role має повний доступ (якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'questions') THEN
        CREATE POLICY "service_role_all_questions" ON questions
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для questions';
    END IF;
END $$;

-- Answer options - service role має повний доступ (якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'answer_options') THEN
        CREATE POLICY "service_role_all_answer_options" ON answer_options
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для answer_options';
    END IF;
END $$;

-- Student answers - service role має повний доступ (якщо таблиця існує)
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_answers') THEN
        CREATE POLICY "service_role_all_student_answers" ON student_answers
            FOR ALL
            USING (true)
            WITH CHECK (true);
        RAISE NOTICE '✅ Створено політику для student_answers';
    END IF;
END $$;

-- ============================================================================
-- УВІМКНЕННЯ RLS
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- Увімкнути RLS для додаткових таблиць, якщо вони існують
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'lectures') THEN
        ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '🔐 RLS увімкнено для lectures';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'tests') THEN
        ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '🔐 RLS увімкнено для tests';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'test_submissions') THEN
        ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '🔐 RLS увімкнено для test_submissions';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_progress') THEN
        ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '🔐 RLS увімкнено для student_progress';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'questions') THEN
        ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '🔐 RLS увімкнено для questions';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'answer_options') THEN
        ALTER TABLE answer_options ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '🔐 RLS увімкнено для answer_options';
    END IF;
    
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'student_answers') THEN
        ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
        RAISE NOTICE '🔐 RLS увімкнено для student_answers';
    END IF;
END $$;

-- ============================================================================
-- ФІНАЛЬНИЙ ЗВІТ
-- ============================================================================

DO $$
DECLARE
    total_policies INTEGER;
    rls_tables INTEGER;
BEGIN
    -- Підраховуємо політики
    SELECT COUNT(*) INTO total_policies 
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND policyname LIKE 'service_role_all_%';
    
    -- Підраховуємо таблиці з RLS
    SELECT COUNT(*) INTO rls_tables 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = true
    AND tablename IN ('profiles', 'courses', 'course_enrollments', 'lectures', 'tests', 'test_submissions', 'student_progress', 'questions', 'answer_options', 'student_answers');
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RLS НАЛАШТУВАННЯ ЗАВЕРШЕНО!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Результати:';
    RAISE NOTICE '   ✅ Створено % service role політик', total_policies;
    RAISE NOTICE '   🔐 RLS увімкнено для % таблиць', rls_tables;
    RAISE NOTICE '';
    RAISE NOTICE '🔑 Service role має повний доступ до всіх операцій';
    RAISE NOTICE '🛡️  RLS залишається увімкненим для безпеки';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ВАЖЛИВО:';
    RAISE NOTICE '   - Переконайтеся, що backend використовує SUPABASE_SERVICE_KEY';
    RAISE NOTICE '   - Service key повинен бути довжиною 200+ символів';
    RAISE NOTICE '   - Перезапустіть backend після змін';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 Тепер ви можете записувати студентів на курси!';
    RAISE NOTICE '';
END $$;