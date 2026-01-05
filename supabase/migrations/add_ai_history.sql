-- AI History Table
-- Stores user's AI interaction history for lectures

CREATE TABLE IF NOT EXISTS public.ai_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- User and lecture identification
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lecture_id UUID NOT NULL REFERENCES public.lectures(id) ON DELETE CASCADE,
  
  -- AI tool information
  tool_type VARCHAR(50) NOT NULL CHECK (tool_type IN ('summary', 'quiz', 'flashcards', 'mindmap', 'chat')),
  
  -- Result data
  result_data JSONB NOT NULL,
  
  -- Metadata
  processing_time INTEGER NOT NULL, -- in milliseconds
  content_hash VARCHAR(64) NOT NULL, -- for cache invalidation
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_history_user_lecture ON public.ai_history(user_id, lecture_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_user_id ON public.ai_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_lecture_id ON public.ai_history(lecture_id);
CREATE INDEX IF NOT EXISTS idx_ai_history_tool_type ON public.ai_history(tool_type);
CREATE INDEX IF NOT EXISTS idx_ai_history_created_at ON public.ai_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_history_content_hash ON public.ai_history(content_hash);

-- RLS policies
ALTER TABLE public.ai_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own AI history" ON public.ai_history;
DROP POLICY IF EXISTS "Users can insert own AI history" ON public.ai_history;
DROP POLICY IF EXISTS "Users can update own AI history" ON public.ai_history;
DROP POLICY IF EXISTS "Users can delete own AI history" ON public.ai_history;
DROP POLICY IF EXISTS "Service role can manage all AI history" ON public.ai_history;

-- Users can only access their own AI history
CREATE POLICY "Users can view own AI history" ON public.ai_history
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own AI history
CREATE POLICY "Users can insert own AI history" ON public.ai_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own AI history
CREATE POLICY "Users can update own AI history" ON public.ai_history
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own AI history
CREATE POLICY "Users can delete own AI history" ON public.ai_history
  FOR DELETE USING (auth.uid() = user_id);

-- Service role can manage all AI history (for admin operations)
CREATE POLICY "Service role can manage all AI history" ON public.ai_history
  FOR ALL USING (auth.role() = 'service_role');

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_update_ai_history_updated_at ON public.ai_history;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_ai_history_updated_at
  BEFORE UPDATE ON public.ai_history
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_history_updated_at();

-- Function to cleanup old AI history entries (keep only latest 50 per user per lecture)
CREATE OR REPLACE FUNCTION cleanup_ai_history()
RETURNS void AS $$
BEGIN
  -- Delete old entries, keeping only the latest 50 per user per lecture
  DELETE FROM public.ai_history
  WHERE id IN (
    SELECT id
    FROM (
      SELECT id,
             ROW_NUMBER() OVER (
               PARTITION BY user_id, lecture_id 
               ORDER BY created_at DESC
             ) as rn
      FROM public.ai_history
    ) ranked
    WHERE rn > 50
  );
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to run cleanup daily (requires pg_cron extension)
-- This will be handled by the application for now
-- SELECT cron.schedule('cleanup-ai-history', '0 2 * * *', 'SELECT cleanup_ai_history();');

COMMENT ON TABLE public.ai_history IS 'Stores user AI interaction history for lectures';
COMMENT ON COLUMN public.ai_history.user_id IS 'ID of the user who generated the AI result';
COMMENT ON COLUMN public.ai_history.lecture_id IS 'ID of the lecture the AI result was generated for';
COMMENT ON COLUMN public.ai_history.tool_type IS 'Type of AI tool used (summary, quiz, flashcards, mindmap, chat)';
COMMENT ON COLUMN public.ai_history.result_data IS 'AI result data as JSON';
COMMENT ON COLUMN public.ai_history.processing_time IS 'Time taken to generate the result in milliseconds';
COMMENT ON COLUMN public.ai_history.content_hash IS 'Hash of the lecture content used for generation';
COMMENT ON COLUMN public.ai_history.created_at IS 'When the AI result was generated';
COMMENT ON COLUMN public.ai_history.updated_at IS 'When the AI result was last updated';