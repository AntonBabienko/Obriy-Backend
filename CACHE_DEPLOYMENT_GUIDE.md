# AI Response Cache - Database Deployment Guide

This guide provides step-by-step instructions for deploying the AI Response Cache database migrations to production.

## Overview

The cache system requires three database migrations:

1. **`add_ai_response_cache.sql`** - Main cache table with indexes and policies
2. **`add_lecture_content_hashes.sql`** - Content hash tracking for invalidation
3. **`add_ai_cache_stats.sql`** - Statistics and monitoring tables

## Pre-Deployment Checklist

### 1. Backup Database

**Critical**: Always backup your database before running migrations.

```bash
# Using Supabase CLI
supabase db dump --db-url "postgresql://..." > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using pg_dump directly
pg_dump "postgresql://postgres:[password]@[host]:5432/postgres" > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verify Prerequisites

Ensure these tables exist (they should from previous migrations):
- `public.lectures`
- `public.courses`
- `auth.users` (Supabase auth)

```sql
-- Check if required tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('lectures', 'courses');
```

### 3. Check Database Permissions

Verify you have the necessary permissions:

```sql
-- Check current user permissions
SELECT current_user, session_user;

-- Check if you can create tables
SELECT has_table_privilege(current_user, 'public.lectures', 'SELECT');
```

## Migration Deployment Steps

### Step 1: Deploy Main Cache Table

Run the first migration to create the main cache table:

```bash
# Using Supabase CLI
supabase db push --include-all

# Or run SQL directly
psql "postgresql://postgres:[password]@[host]:5432/postgres" -f backend/supabase/migrations/add_ai_response_cache.sql
```

**Verify deployment**:

```sql
-- Check table was created
\d public.ai_response_cache

-- Check indexes were created
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'ai_response_cache';

-- Check RLS policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ai_response_cache';
```

Expected output:
- Table with 11 columns (id, cache_key, operation_type, etc.)
- 5 indexes (cache_key, lecture_ids, operation_type, content_hash, created_at)
- 2 RLS policies (read for authenticated, all for service_role)

### Step 2: Deploy Content Hash Tracking

Run the second migration for content hash tracking:

```bash
# Using Supabase CLI or direct SQL
psql "postgresql://postgres:[password]@[host]:5432/postgres" -f backend/supabase/migrations/add_lecture_content_hashes.sql
```

**Verify deployment**:

```sql
-- Check table was created
\d public.lecture_content_hashes

-- Check foreign key constraint
SELECT conname, confrelid::regclass, conrelid::regclass
FROM pg_constraint
WHERE conname LIKE '%lecture_content_hashes%';

-- Check triggers were created
SELECT trigger_name, event_manipulation, action_statement
FROM information_schema.triggers
WHERE event_object_table = 'lecture_content_hashes';
```

Expected output:
- Table with 3 columns (lecture_id, content_hash, updated_at)
- Foreign key to lectures table with CASCADE delete
- 2 triggers (timestamp update, cache invalidation)

### Step 3: Deploy Statistics Table

Run the third migration for statistics tracking:

```bash
# Using Supabase CLI or direct SQL
psql "postgresql://postgres:[password]@[host]:5432/postgres" -f backend/supabase/migrations/add_ai_cache_stats.sql
```

**Verify deployment**:

```sql
-- Check table was created
\d public.ai_cache_stats

-- Check functions were created
SELECT proname, prosrc 
FROM pg_proc 
WHERE proname IN ('increment_cache_stats', 'get_cache_stats');

-- Test the statistics function
SELECT * FROM get_cache_stats();
```

Expected output:
- Table with 7 columns (id, date, total_requests, etc.)
- 2 functions (increment_cache_stats, get_cache_stats)
- Unique constraint on date column

## Post-Deployment Verification

### 1. Test Cache Operations

Run these queries to verify the cache system is ready:

```sql
-- Test cache insertion
INSERT INTO public.ai_response_cache (
  cache_key, operation_type, lecture_ids, params, content_hash,
  response_data, tokens_used, content_size
) VALUES (
  'test_key_123', 'test_generation', ARRAY['00000000-0000-0000-0000-000000000000']::UUID[],
  '{"questionsCount": 5}', 'test_hash_456',
  '{"questions": ["Test question?"]}', 100, 1024
);

-- Test cache retrieval
SELECT cache_key, operation_type, hit_count 
FROM public.ai_response_cache 
WHERE cache_key = 'test_key_123';

-- Test cache update (simulate hit)
UPDATE public.ai_response_cache 
SET hit_count = hit_count + 1, last_accessed_at = NOW()
WHERE cache_key = 'test_key_123';

-- Clean up test data
DELETE FROM public.ai_response_cache WHERE cache_key = 'test_key_123';
```

### 2. Test Content Hash Operations

```sql
-- Test hash insertion (use a real lecture ID if available)
INSERT INTO public.lecture_content_hashes (lecture_id, content_hash)
VALUES ('00000000-0000-0000-0000-000000000000', 'sample_hash_789')
ON CONFLICT (lecture_id) DO UPDATE SET 
  content_hash = EXCLUDED.content_hash;

-- Test hash retrieval
SELECT lecture_id, content_hash, updated_at
FROM public.lecture_content_hashes
WHERE lecture_id = '00000000-0000-0000-0000-000000000000';

-- Clean up test data
DELETE FROM public.lecture_content_hashes 
WHERE lecture_id = '00000000-0000-0000-0000-000000000000';
```

### 3. Test Statistics Operations

```sql
-- Test statistics increment
SELECT increment_cache_stats(CURRENT_DATE, true, 150);
SELECT increment_cache_stats(CURRENT_DATE, false, 0);

-- Test statistics retrieval
SELECT * FROM get_cache_stats(CURRENT_DATE, CURRENT_DATE);

-- Check raw statistics
SELECT * FROM public.ai_cache_stats WHERE date = CURRENT_DATE;

-- Clean up test data
DELETE FROM public.ai_cache_stats WHERE date = CURRENT_DATE;
```

## Performance Verification

### 1. Index Performance

Test that indexes are being used effectively:

```sql
-- Test cache key lookup (should use idx_ai_cache_key)
EXPLAIN ANALYZE 
SELECT * FROM public.ai_response_cache 
WHERE cache_key = 'some_key';

-- Test lecture ID lookup (should use idx_ai_cache_lecture_ids)
EXPLAIN ANALYZE 
SELECT * FROM public.ai_response_cache 
WHERE lecture_ids @> ARRAY['00000000-0000-0000-0000-000000000000']::UUID[];

-- Test date range lookup (should use idx_ai_cache_stats_date)
EXPLAIN ANALYZE 
SELECT * FROM public.ai_cache_stats 
WHERE date BETWEEN '2024-01-01' AND '2024-01-31';
```

### 2. Storage Usage

Monitor storage usage after deployment:

```sql
-- Check table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE tablename IN ('ai_response_cache', 'lecture_content_hashes', 'ai_cache_stats')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Check index sizes
SELECT 
  indexname,
  pg_size_pretty(pg_relation_size(indexname::regclass)) as size
FROM pg_indexes 
WHERE tablename IN ('ai_response_cache', 'lecture_content_hashes', 'ai_cache_stats');
```

## Rollback Procedures

If issues occur, you can rollback the migrations:

### 1. Drop Cache Tables (Full Rollback)

```sql
-- Drop in reverse order due to dependencies
DROP TABLE IF EXISTS public.ai_cache_stats CASCADE;
DROP TABLE IF EXISTS public.lecture_content_hashes CASCADE;
DROP TABLE IF EXISTS public.ai_response_cache CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS increment_cache_stats(DATE, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS get_cache_stats(DATE, DATE);
DROP FUNCTION IF EXISTS update_cache_access();
DROP FUNCTION IF EXISTS update_lecture_hash_timestamp();
DROP FUNCTION IF EXISTS invalidate_cache_on_lecture_change();
DROP FUNCTION IF EXISTS update_cache_stats_timestamp();
```

### 2. Partial Rollback (Keep Some Tables)

```sql
-- Drop only statistics table
DROP TABLE IF EXISTS public.ai_cache_stats CASCADE;
DROP FUNCTION IF EXISTS increment_cache_stats(DATE, BOOLEAN, INTEGER);
DROP FUNCTION IF EXISTS get_cache_stats(DATE, DATE);

-- Or drop only content hashes
DROP TABLE IF EXISTS public.lecture_content_hashes CASCADE;
DROP FUNCTION IF EXISTS update_lecture_hash_timestamp();
DROP FUNCTION IF EXISTS invalidate_cache_on_lecture_change();
```

### 3. Restore from Backup

```bash
# Restore full database from backup
psql "postgresql://postgres:[password]@[host]:5432/postgres" < backup_20240115_143000.sql

# Or restore specific tables
pg_restore --table=ai_response_cache backup_20240115_143000.sql
```

## Monitoring After Deployment

### 1. Set Up Monitoring Queries

Create monitoring queries to run regularly:

```sql
-- Daily cache performance
SELECT 
  date,
  total_requests,
  cache_hits,
  cache_misses,
  ROUND((cache_hits::NUMERIC / total_requests::NUMERIC) * 100, 2) as hit_rate,
  tokens_saved
FROM public.ai_cache_stats 
ORDER BY date DESC 
LIMIT 7;

-- Cache table growth
SELECT 
  COUNT(*) as total_entries,
  pg_size_pretty(pg_total_relation_size('public.ai_response_cache')) as table_size,
  AVG(content_size) as avg_entry_size,
  MAX(created_at) as newest_entry,
  MIN(created_at) as oldest_entry
FROM public.ai_response_cache;

-- Most accessed cache entries
SELECT 
  operation_type,
  hit_count,
  content_size,
  created_at,
  last_accessed_at
FROM public.ai_response_cache 
ORDER BY hit_count DESC 
LIMIT 10;
```

### 2. Set Up Alerts

Consider setting up alerts for:
- Cache hit rate below 30%
- Cache table size exceeding 1GB
- No cache activity for 24 hours
- High number of cache misses

### 3. Regular Maintenance

Schedule regular maintenance tasks:

```sql
-- Weekly cleanup of old entries (>30 days)
DELETE FROM public.ai_response_cache 
WHERE created_at < NOW() - INTERVAL '30 days';

-- Monthly statistics cleanup (>90 days)
DELETE FROM public.ai_cache_stats 
WHERE date < CURRENT_DATE - INTERVAL '90 days';

-- Analyze tables for query optimization
ANALYZE public.ai_response_cache;
ANALYZE public.lecture_content_hashes;
ANALYZE public.ai_cache_stats;
```

## Troubleshooting

### Common Issues

**Migration fails with permission error**:
```sql
-- Check current user permissions
SELECT current_user, session_user;

-- Grant necessary permissions
GRANT CREATE ON SCHEMA public TO current_user;
GRANT USAGE ON SCHEMA public TO current_user;
```

**Foreign key constraint fails**:
```sql
-- Check if lectures table exists
SELECT COUNT(*) FROM public.lectures;

-- Check if there are any orphaned references
SELECT lecture_id 
FROM public.lecture_content_hashes 
WHERE lecture_id NOT IN (SELECT id FROM public.lectures);
```

**Index creation is slow**:
- This is normal for large tables
- Consider running during low-traffic periods
- Monitor progress with `SELECT * FROM pg_stat_progress_create_index;`

**RLS policies not working**:
```sql
-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'ai_response_cache';

-- Check policy definitions
SELECT * FROM pg_policies WHERE tablename = 'ai_response_cache';
```

### Getting Help

If you encounter issues:

1. **Check logs**: Review PostgreSQL logs for detailed error messages
2. **Verify prerequisites**: Ensure all required tables and permissions exist
3. **Test incrementally**: Deploy one migration at a time
4. **Use transactions**: Wrap migrations in transactions for easy rollback
5. **Contact support**: Provide specific error messages and migration step

## Success Criteria

The deployment is successful when:

- ✅ All three tables are created with correct schema
- ✅ All indexes are created and being used
- ✅ RLS policies are active and working
- ✅ Functions and triggers are operational
- ✅ Test cache operations work correctly
- ✅ No performance degradation on existing queries
- ✅ Monitoring queries return expected results

## Next Steps

After successful deployment:

1. **Deploy backend code** with cache service enabled
2. **Monitor performance** for first 24 hours
3. **Verify cache hit rates** are improving over time
4. **Set up automated cleanup** jobs
5. **Configure monitoring alerts**
6. **Update application documentation**

The cache system is now ready for production use!