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
