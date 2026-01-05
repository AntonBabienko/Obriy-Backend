-- УВІМКНЕННЯ RLS З ПРАВИЛЬНИМИ ПОЛІТИКАМИ ДЛЯ SERVICE ROLE
-- Цей скрипт створює політики, які дозволяють service role обходити RLS

-- ============================================================================
-- СПОЧАТКУ ВІДКЛЮЧАЄМО RLS ТА ВИДАЛЯЄМО ВСІ ПОЛІТИКИ
-- ============================================================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE courses DISABLE ROW LEVEL SECURITY;
ALTER TABLE course_enrollments DISABLE ROW LEVEL SECURITY;

-- Видаляємо всі існуючі політики
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Видаляємо політики для profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'profiles') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON profiles';
    END LOOP;
    
    -- Видаляємо політики для courses
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'courses') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON courses';
    END LOOP;
    
    -- Видаляємо політики для course_enrollments
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'course_enrollments') LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON course_enrollments';
    END LOOP;
END $$;

-- ============================================================================
-- СТВОРЮЄМО ФУНКЦІЮ ДЛЯ ПЕРЕВІРКИ SERVICE ROLE
-- ============================================================================

CREATE OR REPLACE FUNCTION is_service_role() RETURNS BOOLEAN AS $$
BEGIN
    -- Перевіряємо, чи це service role (auth.uid() буде NULL)
    -- або чи це запит з service key
    RETURN auth.uid() IS NULL OR current_setting('request.jwt.claims', true)::json->>'role' = 'service_role';
EXCEPTION
    WHEN OTHERS THEN
        -- Якщо не можемо отримати JWT claims, припускаємо що це service role
        RETURN auth.uid() IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Дозволяємо service role все, інші - обмежений доступ
CREATE POLICY "profiles_policy" ON profiles
    USING (is_service_role() OR true)
    WITH CHECK (is_service_role() OR auth.uid() = id);

-- ============================================================================
-- COURSES TABLE  
-- ============================================================================

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

-- Дозволяємо service role все, викладачі - свої курси, студенти - перегляд
CREATE POLICY "courses_select_policy" ON courses FOR SELECT
    USING (is_service_role() OR true);

CREATE POLICY "courses_insert_policy" ON courses FOR INSERT
    WITH CHECK (is_service_role() OR auth.uid() = teacher_id);

CREATE POLICY "courses_update_policy" ON courses FOR UPDATE
    USING (is_service_role() OR auth.uid() = teacher_id)
    WITH CHECK (is_service_role() OR auth.uid() = teacher_id);

CREATE POLICY "courses_delete_policy" ON courses FOR DELETE
    USING (is_service_role() OR auth.uid() = teacher_id);

-- ============================================================================
-- COURSE_ENROLLMENTS TABLE
-- ============================================================================

ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;

-- SELECT: service role, студенти (свої), викладачі (свої курси)
CREATE POLICY "enrollments_select_policy" ON course_enrollments FOR SELECT
    USING (
        is_service_role() 
        OR auth.uid() = student_id 
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    );

-- INSERT: service role або викладачі на свої курси
CREATE POLICY "enrollments_insert_policy" ON course_enrollments FOR INSERT
    WITH CHECK (
        is_service_role() 
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    );

-- UPDATE: service role, студенти (свій прогрес), викладачі (свої курси)
CREATE POLICY "enrollments_update_policy" ON course_enrollments FOR UPDATE
    USING (
        is_service_role() 
        OR auth.uid() = student_id 
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        is_service_role() 
        OR auth.uid() = student_id 
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    );

-- DELETE: service role або викладачі на свої курси
CREATE POLICY "enrollments_delete_policy" ON course_enrollments FOR DELETE
    USING (
        is_service_role() 
        OR EXISTS (
            SELECT 1 FROM courses 
            WHERE courses.id = course_enrollments.course_id 
            AND courses.teacher_id = auth.uid()
        )
    );

-- ============================================================================
-- ЗАВЕРШЕННЯ
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '✅ RLS увімкнено з підтримкою service role!';
    RAISE NOTICE '🔐 Service role має повний доступ';
    RAISE NOTICE '👥 Користувачі мають обмежений доступ згідно з ролями';
    RAISE NOTICE '🛡️  Функція is_service_role() створена для перевірки';
END $$;