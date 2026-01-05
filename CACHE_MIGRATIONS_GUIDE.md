# AI Response Cache Migrations Guide

## Overview

This guide explains how to apply the AI response caching database migrations to your Supabase database.

## Migration Files

Three migration files have been created:

1. **add_ai_response_cache.sql** - Main cache table
2. **add_lecture_content_hashes.sql** - Content hash tracking
3. **add_ai_cache_stats.sql** - Statistics and metrics

## How to Apply Migrations

### Option 1: Supabase SQL Editor (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click on "SQL Editor" in the left sidebar
   - Click "New Query"

3. **Run Each Migration**
   
   **Step 1: Run add_ai_response_cache.sql**
   - Copy the entire contents of `backend/supabase/migrations/add_ai_response_cache.sql`
   - Paste into SQL Editor
   - Click "Run" or press Ctrl+Enter
   - Wait for success message

   **Step 2: Run add_lecture_content_hashes.sql**
   - Copy the entire contents of `backend/supabase/migrations/add_lecture_content_hashes.sql`
   - Paste into SQL Editor
   - Click "Run"
   - Wait for success message

   **Step 3: Run add_ai_cache_stats.sql**
   - Copy the entire contents of `backend/supabase/migrations/add_ai_cache_stats.sql`
   - Paste into SQL Editor
   - Click "Run"
   - Wait for success message

### Option 2: Supabase CLI

If you have Supabase CLI installed:

```bash
cd backend
supabase db push
```

### Option 3: psql Command Line

If you have direct database access:

```bash
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/add_ai_response_cache.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/add_lecture_content_hashes.sql

psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres" \
  -f supabase/migrations/add_ai_cache_stats.sql
```

## Verification

After running the migrations, verify the tables were created:

### Check Tables Exist

Run this SQL in Supabase SQL Editor:

```sql
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_response_cache', 'lecture_content_hashes', 'ai_cache_stats');
```

You should see all three tables listed.

### Check Table Structure

```sql
-- Check ai_response_cache structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ai_response_cache';

-- Check indexes
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'ai_response_cache';
```

### Test Insert

```sql
-- Test inserting a cache entry
INSERT INTO public.ai_response_cache (
  cache_key,
  operation_type,
  lecture_ids,
  params,
  content_hash,
  response_data,
  tokens_used,
  content_size
) VALUES (
  'test_key_123',
  'test_generation',
  ARRAY['00000000-0000-0000-0000-000000000000']::UUID[],
  '{"questionsCount": 10}'::JSONB,
  'test_hash',
  '{"questions": []}'::JSONB,
  100,
  1000
);

-- Verify it was inserted
SELECT * FROM public.ai_response_cache WHERE cache_key = 'test_key_123';

-- Clean up test data
DELETE FROM public.ai_response_cache WHERE cache_key = 'test_key_123';
```

## Troubleshooting

### Error: "relation already exists"

This means the table was already created. You can either:
- Skip this migration
- Drop the existing table first (⚠️ WARNING: This will delete all data)

```sql
DROP TABLE IF EXISTS public.ai_response_cache CASCADE;
DROP TABLE IF EXISTS public.lecture_content_hashes CASCADE;
DROP TABLE IF EXISTS public.ai_cache_stats CASCADE;
```

### Error: "permission denied"

Make sure you're using the service role key or have sufficient permissions.

### Error: "function does not exist"

Some functions might depend on extensions. Make sure these are enabled:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

## What These Migrations Do

### ai_response_cache Table

Stores cached AI responses with:
- Unique cache keys (SHA-256 hashes)
- Operation type (test_generation, chat, summary, etc.)
- Lecture IDs array
- Request parameters
- Content hash for invalidation
- Response data (JSONB)
- Token usage and content size
- Hit count and access timestamps

### lecture_content_hashes Table

Tracks content hashes for lectures:
- Links to lectures table
- SHA-256 hash of content
- Automatic cache invalidation on content change

### ai_cache_stats Table

Daily statistics:
- Total requests
- Cache hits and misses
- Tokens saved
- Helper functions for metrics

## Next Steps

After successfully applying migrations:

1. ✅ Verify all tables exist
2. ✅ Check RLS policies are enabled
3. ✅ Test basic insert/select operations
4. ✅ Proceed to implement cache service (Task 2)

## Support

If you encounter issues:
1. Check Supabase logs in Dashboard
2. Verify your service role key has correct permissions
3. Ensure no conflicting table names exist
4. Review the SQL syntax for any database-specific issues
