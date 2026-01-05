-- AI Cache Statistics Table
-- Tracks daily cache performance metrics for monitoring and optimization

CREATE TABLE public.ai_cache_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL UNIQUE,
  total_requests INTEGER DEFAULT 0,
  cache_hits INTEGER DEFAULT 0,
  cache_misses INTEGER DEFAULT 0,
  tokens_saved INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient date-based queries
CREATE INDEX idx_ai_cache_stats_date ON public.ai_cache_stats(date);

-- RLS policies
ALTER TABLE public.ai_cache_stats ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read stats
CREATE POLICY "Authenticated users can read cache stats" ON public.ai_cache_stats
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to manage stats
CREATE POLICY "Service role can manage cache stats" ON public.ai_cache_stats
  FOR ALL USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_cache_stats_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_cache_stats_timestamp
BEFORE UPDATE ON public.ai_cache_stats
FOR EACH ROW
EXECUTE FUNCTION update_cache_stats_timestamp();

-- Function to increment cache statistics
CREATE OR REPLACE FUNCTION increment_cache_stats(
  p_date DATE,
  p_is_hit BOOLEAN,
  p_tokens_saved INTEGER DEFAULT 0
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.ai_cache_stats (date, total_requests, cache_hits, cache_misses, tokens_saved)
  VALUES (
    p_date,
    1,
    CASE WHEN p_is_hit THEN 1 ELSE 0 END,
    CASE WHEN p_is_hit THEN 0 ELSE 1 END,
    p_tokens_saved
  )
  ON CONFLICT (date) DO UPDATE SET
    total_requests = ai_cache_stats.total_requests + 1,
    cache_hits = ai_cache_stats.cache_hits + CASE WHEN p_is_hit THEN 1 ELSE 0 END,
    cache_misses = ai_cache_stats.cache_misses + CASE WHEN p_is_hit THEN 0 ELSE 1 END,
    tokens_saved = ai_cache_stats.tokens_saved + p_tokens_saved,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to get cache statistics for a date range
CREATE OR REPLACE FUNCTION get_cache_stats(
  p_start_date DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  total_requests BIGINT,
  total_hits BIGINT,
  total_misses BIGINT,
  hit_rate NUMERIC,
  total_tokens_saved BIGINT,
  estimated_cost_saved NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(s.total_requests), 0)::BIGINT as total_requests,
    COALESCE(SUM(s.cache_hits), 0)::BIGINT as total_hits,
    COALESCE(SUM(s.cache_misses), 0)::BIGINT as total_misses,
    CASE 
      WHEN SUM(s.total_requests) > 0 
      THEN ROUND((SUM(s.cache_hits)::NUMERIC / SUM(s.total_requests)::NUMERIC) * 100, 2)
      ELSE 0
    END as hit_rate,
    COALESCE(SUM(s.tokens_saved), 0)::BIGINT as total_tokens_saved,
    ROUND((COALESCE(SUM(s.tokens_saved), 0)::NUMERIC / 1000000) * 0.075, 4) as estimated_cost_saved
  FROM public.ai_cache_stats s
  WHERE s.date BETWEEN p_start_date AND p_end_date;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.ai_cache_stats IS 'Daily statistics for AI response cache performance monitoring';
COMMENT ON COLUMN public.ai_cache_stats.date IS 'Date for which statistics are recorded';
COMMENT ON COLUMN public.ai_cache_stats.total_requests IS 'Total number of AI requests on this date';
COMMENT ON COLUMN public.ai_cache_stats.cache_hits IS 'Number of requests served from cache';
COMMENT ON COLUMN public.ai_cache_stats.cache_misses IS 'Number of requests that required API calls';
COMMENT ON COLUMN public.ai_cache_stats.tokens_saved IS 'Total tokens saved by using cache';
COMMENT ON FUNCTION increment_cache_stats IS 'Increments cache statistics for a given date';
COMMENT ON FUNCTION get_cache_stats IS 'Returns aggregated cache statistics for a date range';
