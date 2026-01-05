-- Виправлення RLS політик для courses
-- Дозволяємо service role обходити RLS

-- Видаляємо існуючі політики
DROP POLICY IF EXISTS "Teachers can manage their courses" ON courses;
DROP POLICY IF EXISTS "Students can view courses" ON courses;

-- Створюємо нові політики з підтримкою service role

-- Політика для SELECT (перегляд курсів)
CREATE POLICY "View courses"
    ON courses FOR SELECT
    USING (
        -- Service role може бачити все
        auth.uid() IS NULL
        OR
        -- Всі можуть переглядати курси
        true
    );

-- Політика для INSERT (створення курсів)
CREATE POLICY "Teachers can create courses"
    ON courses FOR INSERT
    WITH CHECK (
        -- Service role може створювати курси
        auth.uid() IS NULL
        OR
        -- Викладачі можуть створювати курси (teacher_id = auth.uid())
        auth.uid() = teacher_id
    );

-- Політика для UPDATE (оновлення курсів)
CREATE POLICY "Teachers can update their courses"
    ON courses FOR UPDATE
    USING (
        -- Service role може оновлювати все
        auth.uid() IS NULL
        OR
        -- Викладачі можуть оновлювати свої курси
        auth.uid() = teacher_id
    )
    WITH CHECK (
        -- Service role може оновлювати все
        auth.uid() IS NULL
        OR
        -- Викладачі можуть оновлювати свої курси
        auth.uid() = teacher_id
    );

-- Політика для DELETE (видалення курсів)
CREATE POLICY "Teachers can delete their courses"
    ON courses FOR DELETE
    USING (
        -- Service role може видаляти все
        auth.uid() IS NULL
        OR
        -- Викладачі можуть видаляти свої курси
        auth.uid() = teacher_id
    );

-- Додаємо коментарі
COMMENT ON POLICY "View courses" ON courses 
    IS 'Дозволяє переглядати курси всім користувачам та service role';

COMMENT ON POLICY "Teachers can create courses" ON courses 
    IS 'Дозволяє викладачам та service role створювати курси';

COMMENT ON POLICY "Teachers can update their courses" ON courses 
    IS 'Дозволяє викладачам та service role оновлювати курси';

COMMENT ON POLICY "Teachers can delete their courses" ON courses 
    IS 'Дозволяє викладачам та service role видаляти курси';