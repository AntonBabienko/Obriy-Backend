-- Комплексне виправлення RLS політик для всіх таблиць
-- Виконайте цей скрипт в Supabase SQL Editor

-- ============================================================================
-- ВАЖЛИВО: Цей скрипт налаштовує RLS для роботи з service role
-- Backend використовує service key, тому auth.uid() завжди NULL
-- ============================================================================

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

-- Видаляємо існуючі політики для profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "View profiles" ON profiles;
DROP POLICY IF EXISTS "Service can create profiles" ON profiles;
DROP POLICY IF EXISTS "Service can delete profiles" ON profiles;

-- Створюємо політики, які дозволяють service role (auth.uid() IS NULL)
CREATE POLICY "service_role_profiles_policy" ON profiles
    FOR ALL
    USING (true)  -- Service role може все
    WITH CHECK (true);

-- ============================================================================
-- COURSES TABLE
-- ============================================================================

-- Видаляємо існуючі політики для courses
DROP POLICY IF EXISTS "Teachers can manage their courses" ON courses;
DROP POLICY IF EXISTS "Students can view courses" ON courses;
DROP POLICY IF EXISTS "View courses" ON courses;
DROP POLICY IF EXISTS "Teachers can create courses" ON courses;
DROP POLICY IF EXISTS "Teachers can update their courses" ON courses;
DROP POLICY IF EXISTS "Teachers can delete their courses" ON courses;

-- Створюємо політики для service role
CREATE POLICY "service_role_courses_policy" ON courses
    FOR ALL
    USING (true)  -- Service role може все
    WITH CHECK (true);

-- ============================================================================
-- COURSE_ENROLLMENTS TABLE
-- ============================================================================

-- Видаляємо всі існуючі політики для course_enrollments
DROP POLICY IF EXISTS "Students can view their own enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can view enrollments for their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can enroll students in their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can remove students from their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Students can update their own progress" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can update student progress" ON course_enrollments;
DROP POLICY IF EXISTS "Students and teachers can update progress" ON course_enrollments;
DROP POLICY IF EXISTS "View enrollments" ON course_enrollments;

-- Створюємо політики для service role
CREATE POLICY "service_role_enrollments_policy" ON course_enrollments
    FOR ALL
    USING (true)  -- Service role може все
    WITH CHECK (true);

-- ============================================================================
-- ІНШІ ТАБЛИЦІ (якщо існують)
-- ============================================================================

-- Lectures
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lectures') THEN
        DROP POLICY IF EXISTS "Teachers can manage lectures" ON lectures;
        DROP POLICY IF EXISTS "Students can view lectures" ON lectures;
        
        CREATE POLICY "service_role_lectures_policy" ON lectures
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Tests
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tests') THEN
        DROP POLICY IF EXISTS "Teachers can manage tests" ON tests;
        DROP POLICY IF EXISTS "Students can view their tests" ON tests;
        
        CREATE POLICY "service_role_tests_policy" ON tests
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Test submissions
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'test_submissions') THEN
        DROP POLICY IF EXISTS "Students can manage their submissions" ON test_submissions;
        DROP POLICY IF EXISTS "Teachers can view submissions" ON test_submissions;
        
        CREATE POLICY "service_role_submissions_policy" ON test_submissions
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- Student progress
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_progress') THEN
        DROP POLICY IF EXISTS "Students can manage their progress" ON student_progress;
        DROP POLICY IF EXISTS "Teachers can view student progress" ON student_progress;
        
        CREATE POLICY "service_role_progress_policy" ON student_progress
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

-- ============================================================================
-- ПЕРЕВІРКА ТА ЗАВЕРШЕННЯ
-- ============================================================================

-- Переконуємося, що RLS увімкнено
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- Увімкнути RLS для додаткових таблиць, якщо вони існують
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'lectures') THEN
        ALTER TABLE lectures ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'tests') THEN
        ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'test_submissions') THEN
        ALTER TABLE test_submissions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'student_progress') THEN
        ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- Перевіряємо результат
DO $$
DECLARE
    profile_policies INTEGER;
    course_policies INTEGER;
    enrollment_policies INTEGER;
BEGIN
    -- Підраховуємо політики
    SELECT COUNT(*) INTO profile_policies FROM pg_policies WHERE tablename = 'profiles';
    SELECT COUNT(*) INTO course_policies FROM pg_policies WHERE tablename = 'courses';
    SELECT COUNT(*) INTO enrollment_policies FROM pg_policies WHERE tablename = 'course_enrollments';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ RLS політики оновлено для service role!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Статистика політик:';
    RAISE NOTICE '   profiles: % політик', profile_policies;
    RAISE NOTICE '   courses: % політик', course_policies;
    RAISE NOTICE '   course_enrollments: % політик', enrollment_policies;
    RAISE NOTICE '';
    RAISE NOTICE '🔑 Service role має повний доступ до всіх таблиць';
    RAISE NOTICE '🛡️  RLS залишається увімкненим для безпеки';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ВАЖЛИВО: Ці політики дозволяють service role все';
    RAISE NOTICE '   Переконайтеся, що ваш backend використовує service key';
    RAISE NOTICE '';
END $$;