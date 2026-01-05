-- Виправлення RLS політик для profiles
-- Дозволяємо service role обходити RLS

-- Видаляємо існуючі політики
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Створюємо нові політики з підтримкою service role

-- Політика для SELECT (перегляд профілів)
CREATE POLICY "View profiles"
    ON profiles FOR SELECT
    USING (
        -- Service role може бачити все
        auth.uid() IS NULL
        OR
        -- Всі можуть переглядати профілі
        true
    );

-- Політика для INSERT (створення профілів)
CREATE POLICY "Service can create profiles"
    ON profiles FOR INSERT
    WITH CHECK (
        -- Тільки service role може створювати профілі
        auth.uid() IS NULL
        OR
        -- Або користувач створює свій профіль
        auth.uid() = id
    );

-- Політика для UPDATE (оновлення профілів)
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (
        -- Service role може оновлювати все
        auth.uid() IS NULL
        OR
        -- Користувачі можуть оновлювати свій профіль
        auth.uid() = id
    )
    WITH CHECK (
        -- Service role може оновлювати все
        auth.uid() IS NULL
        OR
        -- Користувачі можуть оновлювати свій профіль
        auth.uid() = id
    );

-- Політика для DELETE (видалення профілів)
CREATE POLICY "Service can delete profiles"
    ON profiles FOR DELETE
    USING (
        -- Тільки service role може видаляти профілі
        auth.uid() IS NULL
    );

-- Додаємо коментарі
COMMENT ON POLICY "View profiles" ON profiles 
    IS 'Дозволяє переглядати профілі всім користувачам та service role';

COMMENT ON POLICY "Service can create profiles" ON profiles 
    IS 'Дозволяє service role та користувачам створювати профілі';

COMMENT ON POLICY "Users can update own profile" ON profiles 
    IS 'Дозволяє користувачам та service role оновлювати профілі';

COMMENT ON POLICY "Service can delete profiles" ON profiles 
    IS 'Дозволяє тільки service role видаляти профілі';