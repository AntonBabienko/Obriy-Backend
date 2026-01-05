# Apply AI Response Cache Migrations

## Quick Start

The migration SQL files have been created and are ready to apply. Follow these steps:

### Step 1: Open Supabase SQL Editor

1. Go to https://supabase.com/dashboard
2. Select your project: **trufpynrzkygridecvaj**
3. Click "SQL Editor" in the left sidebar
4. Click "New Query"

### Step 2: Run Migration 1 - ai_response_cache

Copy and paste this entire SQL block into the SQL Editor and click "Run":

```sql
-- AI Response Cache Table
-- Stores cached AI responses to reduce API calls and improve performance

CREATE TABLE public.ai_response_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Cache identification
  cache_key VARCHAR(64) NOT NULL UNIQUE,
  operation_type VARCHAR(50) NOT NULL,
  
  -- Related data
  lecture_ids UUID[] NOT NULL,
  params JSONB NOT NULL,
  content_hash VARCHAR(64) NOT NULL,
  
  -- Response data
  response_data JSONB NOT NULL,
  
  -- Metadata
  tokens_used INTEGER NOT NULL,
  content_size INTEGER NOT NULL,
  hit_count INTEGER DEFAULT 0,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_accessed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_ai_cache_key ON public.ai_response_cache(cache_key);
CREATE INDEX idx_ai_cache_lecture_ids ON public.ai_response_cache USING GIN (lecture_ids);
CREATE INDEX idx_ai_cache_operation_type ON public.ai_response_cache(operation_type);
CREATE INDEX idx_ai_cache_content_hash ON public.ai_response_cache(content_hash);
CREATE INDEX idx_ai_cache_created_at ON public.ai_response_cache(created_at);

-- RLS policies
ALTER TABLE public.ai_response_cache ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read cache (cache is shared across users)
CREATE POLICY "Authenticated users can read cache" ON public.ai_response_cache
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow service role to insert/update cache
CREATE POLICY "Service role can manage cache" ON public.ai_response_cache
  FOR ALL USING (auth.role() = 'service_role');

-- Function to update last_accessed_at on cache hit
CREATE OR REPLACE FUNCTION update_cache_access()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_accessed_at = NOW();
  NEW.hit_count = OLD.hit_count + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE public.ai_response_cache IS 'Stores cached AI responses to reduce API calls and improve performance';
COMMENT ON COLUMN public.ai_response_cache.cache_key IS 'Unique SHA-256 hash identifying the request';
COMMENT ON COLUMN public.ai_response_cache.operation_type IS 'Type of AI operation (test_generation, chat, summary, etc.)';
COMMENT ON COLUMN public.ai_response_cache.lecture_ids IS 'Array of lecture IDs used in the request';
COMMENT ON COLUMN public.ai_response_cache.params IS 'Request parameters as JSON';
COMMENT ON COLUMN public.ai_response_cache.content_hash IS 'SHA-256 hash of lecture content for invalidation';
COMMENT ON COLUMN public.ai_response_cache.response_data IS 'Cached AI response as JSON';
COMMENT ON COLUMN public.ai_response_cache.tokens_used IS 'Number of tokens used in original API call';
COMMENT ON COLUMN public.ai_response_cache.content_size IS 'Size of content in bytes';
COMMENT ON COLUMN public.ai_response_cache.hit_count IS 'Number of times this cache entry was used';
COMMENT ON COLUMN public.ai_response_cache.last_accessed_at IS 'Last time this cache entry was accessed';
```

✅ You should see "Success. No rows returned"

### Step 3: Run Migration 2 - lecture_content_hashes

Copy and paste this entire SQL block into a new query and click "Run":

```sql
-- Lecture Content Hashes Table
-- Tracks content hashes for lectures to detect changes and invalidate cache

CREATE TABLE public.lecture_content_hashes (
  lecture_id UUID PRIMARY KEY REFERENCES public.lectures(id) ON DELETE CASCADE,
  content_hash VARCHAR(64) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient hash lookups
CREATE INDEX idx_lecture_content_hash ON public.lecture_content_hashes(content_hash);

-- RLS policies
ALTER TABLE public.lecture_content_hashes ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read hashes
CREATE POLICY "Authenticated users can read lecture hashes" ON public.lecture_content_hashes
  FOR SELECT USING (auth.role() = 'authenticated');

-- Allow teachers to update hashes for their lectures
CREATE POLICY "Teachers can update hashes for their lectures" ON public.lecture_content_hashes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lectures
      JOIN public.courses ON lectures.course_id = courses.id
      WHERE lectures.id = lecture_content_hashes.lecture_id
      AND courses.teacher_id = auth.uid()
    )
  );

-- Allow service role to manage hashes
CREATE POLICY "Service role can manage lecture hashes" ON public.lecture_content_hashes
  FOR ALL USING (auth.role() = 'service_role');

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_lecture_hash_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_lecture_hash_timestamp
BEFORE UPDATE ON public.lecture_content_hashes
FOR EACH ROW
EXECUTE FUNCTION update_lecture_hash_timestamp();

-- Function to invalidate cache when lecture content changes
CREATE OR REPLACE FUNCTION invalidate_cache_on_lecture_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete cache entries that contain this lecture_id
  DELETE FROM public.ai_response_cache
  WHERE NEW.lecture_id = ANY(lecture_ids);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invalidate_cache_on_lecture_change
AFTER UPDATE ON public.lecture_content_hashes
FOR EACH ROW
WHEN (OLD.content_hash IS DISTINCT FROM NEW.content_hash)
EXECUTE FUNCTION invalidate_cache_on_lecture_change();

COMMENT ON TABLE public.lecture_content_hashes IS 'Tracks SHA-256 hashes of lecture content to detect changes and invalidate cache';
COMMENT ON COLUMN public.lecture_content_hashes.content_hash IS 'SHA-256 hash of normalized lecture content';
COMMENT ON COLUMN public.lecture_content_hashes.updated_at IS 'Last time the content hash was updated';
```

✅ You should see "Success. No rows returned"

### Step 4: Run Migration 3 - ai_cache_stats

Copy and paste this entire SQL block into a new query and click "Run":

```sql
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
```

✅ You should see "Success. No rows returned"

### Step 5: Verify Tables Created

Run this verification query:

```sql
-- Check if all tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_response_cache', 'lecture_content_hashes', 'ai_cache_stats')
ORDER BY table_name;
```

✅ You should see all 3 tables listed:
- ai_cache_stats
- ai_response_cache
- lecture_content_hashes

### Step 6: Test the Setup

Run this test query to verify everything works:

```sql
-- Test cache stats function
SELECT * FROM get_cache_stats();
```

✅ You should see a row with all zeros (no data yet)

## What Was Created

### Tables
1. **ai_response_cache** - Stores cached AI responses
2. **lecture_content_hashes** - Tracks lecture content for cache invalidation
3. **ai_cache_stats** - Daily statistics for monitoring

### Functions
1. **update_cache_access()** - Updates cache hit count
2. **update_lecture_hash_timestamp()** - Updates hash timestamp
3. **invalidate_cache_on_lecture_change()** - Auto-invalidates cache
4. **update_cache_stats_timestamp()** - Updates stats timestamp
5. **increment_cache_stats()** - Increments daily statistics
6. **get_cache_stats()** - Retrieves aggregated statistics

### Indexes
- Cache key lookup (unique)
- Lecture IDs array (GIN index)
- Operation type
- Content hash
- Created date
- Stats date

### RLS Policies
- Authenticated users can read cache
- Service role can manage all tables
- Teachers can manage their lecture hashes

## Next Steps

After successfully running all migrations:

1. ✅ Mark Task 1 as complete
2. ➡️ Proceed to Task 2: Implement Content Hash Service
3. ➡️ Then Task 3: Implement AI Cache Service

## Troubleshooting

If you see "relation already exists" errors, the tables may have been created already. You can check with:

```sql
SELECT * FROM public.ai_response_cache LIMIT 1;
```

If this works, the migrations are already applied!

## Files Created

- `backend/supabase/migrations/add_ai_response_cache.sql`
- `backend/supabase/migrations/add_lecture_content_hashes.sql`
- `backend/supabase/migrations/add_ai_cache_stats.sql`
- `backend/CACHE_MIGRATIONS_GUIDE.md` (detailed guide)
- `backend/APPLY_CACHE_MIGRATIONS.md` (this file)
