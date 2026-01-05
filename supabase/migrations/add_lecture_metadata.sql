-- Add file size and upload date to lectures table
ALTER TABLE public.lectures 
ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Update existing lectures to have uploaded_at = created_at
UPDATE public.lectures 
SET uploaded_at = created_at 
WHERE uploaded_at IS NULL;
