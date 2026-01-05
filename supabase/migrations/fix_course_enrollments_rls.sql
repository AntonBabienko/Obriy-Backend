-- Виправлення RLS політик для course_enrollments
-- Дозволяємо service role обходити RLS

-- Спочатку видаляємо всі існуючі політики
DROP POLICY IF EXISTS "Students can view their own enrollments" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can view enrollments for their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can enroll students in their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can remove students from their courses" ON course_enrollments;
DROP POLICY IF EXISTS "Students can update their own progress" ON course_enrollments;
DROP POLICY IF EXISTS "Teachers can update student progress" ON course_enrollments;
DROP POLICY IF EXISTS "Students and teachers can update progress" ON course_enrollments;
DROP POLICY IF EXISTS "View enrollments" ON course_enrollments;

-- Створюємо нову політику для SELECT
CREATE POLICY "View enrollments"
    ON course_enrollments FOR SELECT
    USING (
        -- Service role може бачити все
        auth.uid() IS NULL
        OR
        -- Студенти можуть бачити свої записи
        auth.uid() = student_id
        OR
        -- Викладачі можуть бачити записи на свої курси
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Створюємо нову політику для INSERT
CREATE POLICY "Teachers can enroll students in their courses"
    ON course_enrollments FOR INSERT
    WITH CHECK (
        -- Дозволяємо service role (коли auth.uid() = NULL)
        auth.uid() IS NULL
        OR
        -- Або якщо це викладач курсу
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Створюємо нову політику для UPDATE
CREATE POLICY "Students and teachers can update progress"
    ON course_enrollments FOR UPDATE
    USING (
        -- Service role
        auth.uid() IS NULL
        OR
        -- Студент може оновлювати свій прогрес
        auth.uid() = student_id
        OR
        -- Викладач може оновлювати прогрес студентів на своїх курсах
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    )
    WITH CHECK (
        -- Service role
        auth.uid() IS NULL
        OR
        -- Студент може оновлювати свій прогрес
        auth.uid() = student_id
        OR
        -- Викладач може оновлювати прогрес студентів на своїх курсах
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Створюємо нову політику для DELETE
CREATE POLICY "Teachers can remove students from their courses"
    ON course_enrollments FOR DELETE
    USING (
        -- Service role
        auth.uid() IS NULL
        OR
        -- Викладач може видаляти студентів зі своїх курсів
        EXISTS (
            SELECT 1 FROM courses
            WHERE courses.id = course_enrollments.course_id
            AND courses.teacher_id = auth.uid()
        )
    );

-- Додаємо коментарі
COMMENT ON POLICY "View enrollments" ON course_enrollments 
    IS 'Дозволяє переглядати записи: service role - все, студенти - свої, викладачі - на своїх курсах';

COMMENT ON POLICY "Teachers can enroll students in their courses" ON course_enrollments 
    IS 'Дозволяє викладачам та service role записувати студентів на курси';

COMMENT ON POLICY "Students and teachers can update progress" ON course_enrollments 
    IS 'Дозволяє оновлювати прогрес: service role, студенти - свій, викладачі - на своїх курсах';

COMMENT ON POLICY "Teachers can remove students from their courses" ON course_enrollments 
    IS 'Дозволяє викладачам та service role видаляти студентів з курсів';
