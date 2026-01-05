-- Правильні RLS політики для роботи з Supabase Auth
-- Цей підхід використовує auth.uid() для ідентифікації користувачів

-- ============================================================================
-- ОЧИЩЕННЯ ІСНУЮЧИХ ПОЛІТИК
-- ============================================================================

-- Видаляємо всі існуючі політики
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON profiles';
    END LOOP;
    
    -- Courses
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'courses') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON courses';
    END LOOP;
    
    -- Course enrollments
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'course_enrollments') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON course_enrollments';
    END LOOP;
END $$;

-- ============================================================================
-- PROFILES TABLE - Правильні політики з auth.uid()
-- ============================================================================

-- Всі можуть переглядати профілі
CREATE POLICY "profiles_select_policy" ON profiles
    FOR SELECT
    USING (true);

-- Користувачі можуть створювати свій профіль
CREATE POLICY "profiles_insert_policy" ON profiles
    FOR INSERT
    WITH CHECK (auth.uid() = id);

-- Користувачі можуть оновлювати свій профіль
CREATE POLICY "profiles_update_policy" ON profiles
    FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Тільки сам користувач може видалити свій профіль
CREATE POLICY "profiles_delete_policy" ON profiles
    FOR DELETE
    USING (auth.uid() = id);

-- ============================================================================
-- COURSES TABLE - Викладачі управляють своїми курсами
-- ============================================================================

-- Всі можуть переглядати курси
CREATE POLICY "courses_select_policy" ON courses
    FOR SELECT
    USING (true);

-- Викладачі можуть створювати курси
CREATE POLICY "courses_insert_policy" ON courses
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'teacher'
        )
        AND auth.uid() = teacher_id
    );

-- Викладачі можуть оновлювати свої курси
CREATE POLICY "courses_update_policy" ON courses
    FOR UPDATE
    USING (auth.uid() = teacher_id)
    WITH CHECK (auth.uid() = teacher_id);

-- Викладачі можуть видаляти свої курси
CREATE POLICY "courses_delete_policy" ON courses
    FOR DELETE
    USING (auth.uid() = teacher_id);

-- ============================================================================
-- COURSE_ENROLLMENTS TABLE - Записи на курси
-- ============================================================================

-- Студенти бачать свої записи, викладачі - записи на свої курси
CREATE POLICY "enrollments_select_policy" ON course_enrollments
    FOR SELECT
    USING (
        auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    );

-- Викладачі можуть записувати студентів на свої курси
CREATE POLICY "enrollments_insert_policy" ON course_enrollments
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
        AND EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = course_enrollments.student_id 
            AND profiles.role = 'student'
        )
    );

-- Студенти можуть оновлювати свій прогрес, викладачі - прогрес на своїх курсах
CREATE POLICY "enrollments_update_policy" ON course_enrollments
    FOR UPDATE
    USING (
        auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        auth.uid() = student_id
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    );

-- Викладачі можуть видаляти студентів зі своїх курсів
CREATE POLICY "enrollments_delete_policy" ON course_enrollments
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    );

-- ============================================================================
-- УВІМКНЕННЯ RLS
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ПЕРЕВІРКА ТА ЗВІТ
-- ============================================================================

DO $$
DECLARE
    profile_policies INTEGER;
    course_policies INTEGER;
    enrollment_policies INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_policies FROM pg_policies WHERE tablename = 'profiles';
    SELECT COUNT(*) INTO course_policies FROM pg_policies WHERE tablename = 'courses';
    SELECT COUNT(*) INTO enrollment_policies FROM pg_policies WHERE tablename = 'course_enrollments';
    
    RAISE NOTICE '';
    RAISE NOTICE '✅ Правильні RLS політики створено!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 Створено політик:';
    RAISE NOTICE '   profiles: %', profile_policies;
    RAISE NOTICE '   courses: %', course_policies;
    RAISE NOTICE '   course_enrollments: %', enrollment_policies;
    RAISE NOTICE '';
    RAISE NOTICE '🔐 Політики використовують auth.uid() для ідентифікації';
    RAISE NOTICE '👥 Користувачі мають доступ згідно з їх ролями';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️  ВАЖЛИВО: Для роботи потрібно:';
    RAISE NOTICE '   1. Використовувати Supabase Auth в backend';
    RAISE NOTICE '   2. Передавати JWT токени в запитах';
    RAISE NOTICE '   3. Встановлювати сесію для кожного запиту';
    RAISE NOTICE '';
END $$;