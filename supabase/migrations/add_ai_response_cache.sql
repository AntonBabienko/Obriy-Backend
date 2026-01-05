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

-- Trigger to automatically update access time when cache is read
-- Note: This will be called manually from the application when cache is hit
-- to avoid trigger overhead on SELECT queries

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
