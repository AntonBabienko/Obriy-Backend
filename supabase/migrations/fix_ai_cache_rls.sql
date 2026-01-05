-- Fix RLS for ai_response_cache table
-- Allow service role to insert/update cache entries

-- Disable RLS for ai_response_cache (cache should be accessible by backend)
ALTER TABLE IF EXISTS ai_response_cache DISABLE ROW LEVEL SECURITY;

-- Or if you want to keep RLS enabled, add policy for service role
-- DROP POLICY IF EXISTS "Service role can manage cache" ON ai_response_cache;
-- CREATE POLICY "Service role can manage cache" ON ai_response_cache
--     FOR ALL
--     USING (true)
--     WITH CHECK (true);

-- Create increment_cache_stats function if not exists
CREATE OR REPLACE FUNCTION public.increment_cache_stats(
    p_date DATE,
    p_is_hit BOOLEAN,
    p_tokens_saved INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO cache_stats (stat_date, cache_hits, cache_misses, tokens_saved)
    VALUES (p_date, 
            CASE WHEN p_is_hit THEN 1 ELSE 0 END,
            CASE WHEN p_is_hit THEN 0 ELSE 1 END,
            p_tokens_saved)
    ON CONFLICT (stat_date) DO UPDATE SET
        cache_hits = cache_stats.cache_hits + CASE WHEN p_is_hit THEN 1 ELSE 0 END,
        cache_misses = cache_stats.cache_misses + CASE WHEN p_is_hit THEN 0 ELSE 1 END,
        tokens_saved = cache_stats.tokens_saved + p_tokens_saved;
END;
$$;

-- Create cache_stats table if not exists
CREATE TABLE IF NOT EXISTS cache_stats (
    stat_date DATE PRIMARY KEY,
    cache_hits INTEGER DEFAULT 0,
    cache_misses INTEGER DEFAULT 0,
    tokens_saved INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
