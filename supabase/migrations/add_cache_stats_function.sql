-- Створення таблиці для статистики кешу (якщо не існує)
CREATE TABLE IF NOT EXISTS ai_cache_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_date DATE NOT NULL UNIQUE,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    tokens_saved INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Функція для інкременту статистики кешу
CREATE OR REPLACE FUNCTION increment_cache_stats(
    p_date DATE,
    p_is_hit BOOLEAN,
    p_tokens_saved INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO ai_cache_stats (stat_date, cache_hits, cache_misses, tokens_saved)
    VALUES (
        p_date,
        CASE WHEN p_is_hit THEN 1 ELSE 0 END,
        CASE WHEN p_is_hit THEN 0 ELSE 1 END,
        p_tokens_saved
    )
    ON CONFLICT (stat_date) DO UPDATE SET
        cache_hits = ai_cache_stats.cache_hits + CASE WHEN p_is_hit THEN 1 ELSE 0 END,
        cache_misses = ai_cache_stats.cache_misses + CASE WHEN p_is_hit THEN 0 ELSE 1 END,
        tokens_saved = ai_cache_stats.tokens_saved + p_tokens_saved,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Вимкнути RLS для таблиці статистики (доступ тільки через функцію)
ALTER TABLE ai_cache_stats DISABLE ROW LEVEL SECURITY;

-- Дозволити виклик функції для всіх
GRANT EXECUTE ON FUNCTION increment_cache_stats(DATE, BOOLEAN, INTEGER) TO anon, authenticated, service_role;
