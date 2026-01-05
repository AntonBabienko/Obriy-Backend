# AI Response Cache - Backend Deployment Guide

This guide provides step-by-step instructions for deploying the AI Response Cache backend changes to production.

## Overview

The backend deployment includes:

1. **Cache Service** - Core caching functionality (`aiCache.ts`)
2. **Content Hash Service** - Content change detection (`contentHash.ts`)
3. **Updated API Routes** - Modified endpoints with cache integration
4. **Cache Management API** - New endpoints for cache administration
5. **Environment Configuration** - Cache-related settings

## Pre-Deployment Checklist

### 1. Verify Database Migrations

Ensure all cache database migrations have been successfully applied:

```bash
# Check if cache tables exist
psql "postgresql://..." -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('ai_response_cache', 'lecture_content_hashes', 'ai_cache_stats');
"

# Expected output: 3 tables
```

### 2. Update Environment Variables

Add cache configuration to your production environment:

```bash
# Production .env
CACHE_ENABLED=true
CACHE_CLEANUP_DAYS=30
CACHE_CLEANUP_INTERVAL_HOURS=24
CACHE_MAX_ENTRIES=20000
CACHE_MAX_SIZE_MB=1000
DEBUG_CACHE=false
```

### 3. Backup Current Backend

Create a backup of your current backend deployment:

```bash
# Backup current deployment
tar -czf backend_backup_$(date +%Y%m%d_%H%M%S).tar.gz backend/

# Or using git
git tag -a "pre-cache-deployment" -m "Backup before cache deployment"
```

### 4. Test Build Process

Verify the backend builds successfully with cache changes:

```bash
cd backend
npm install
npm run build

# Check for TypeScript errors
npx tsc --noEmit
```

## Deployment Steps

### Step 1: Deploy Cache Services

The cache system includes two main services that need to be deployed:

**Files to deploy:**
- `backend/src/services/aiCache.ts`
- `backend/src/services/contentHash.ts`

**Verification:**
```bash
# Check services can be imported
node -e "
const { AICacheService } = require('./dist/services/aiCache.js');
const { ContentHashService } = require('./dist/services/contentHash.js');
console.log('✅ Cache services loaded successfully');
"
```

### Step 2: Deploy Updated API Routes

The following API routes have been modified to include caching:

**Modified files:**
- `backend/src/routes/test.routes.ts` - Test generation with cache
- `backend/src/routes/ai.routes.ts` - AI chat and summary with cache

**New files:**
- `backend/src/routes/cache.routes.ts` - Cache management API

**Verification:**
```bash
# Check routes can be loaded
node -e "
const testRoutes = require('./dist/routes/test.routes.js');
const aiRoutes = require('./dist/routes/ai.routes.js');
const cacheRoutes = require('./dist/routes/cache.routes.js');
console.log('✅ All routes loaded successfully');
"
```

### Step 3: Update Server Configuration

Ensure the main server file includes cache routes:

**File:** `backend/src/server.ts`

**Verify cache routes are registered:**
```typescript
// Should include:
app.use('/api/cache', cacheRoutes);
```

### Step 4: Deploy to Production

#### Option A: Direct Deployment

```bash
# Stop current server
pm2 stop backend

# Deploy new code
rsync -av --exclude node_modules backend/ production:/path/to/backend/

# Install dependencies
cd /path/to/backend
npm install --production

# Build application
npm run build

# Start server
pm2 start backend
```

#### Option B: Docker Deployment

```bash
# Build new image
docker build -t your-app:cache-v1.0 backend/

# Stop current container
docker stop your-app-backend

# Start new container
docker run -d \
  --name your-app-backend \
  --env-file .env \
  -p 3001:3001 \
  your-app:cache-v1.0
```

#### Option C: Cloud Platform Deployment

**Heroku:**
```bash
git add .
git commit -m "Deploy AI response cache system"
git push heroku main
```

**Railway/Render/etc:**
- Push to connected Git repository
- Platform will automatically deploy

## Post-Deployment Verification

### 1. Health Check

Verify the server starts successfully:

```bash
# Check server status
curl http://localhost:3001/health

# Expected response:
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00Z",
  "cache": {
    "enabled": true,
    "status": "operational"
  }
}
```

### 2. Cache Service Verification

Test cache functionality:

```bash
# Test cache statistics endpoint
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/api/cache/stats

# Expected response:
{
  "totalEntries": 0,
  "totalRequests": 0,
  "cacheHits": 0,
  "cacheMisses": 0,
  "hitRate": 0,
  "tokensSaved": 0,
  "estimatedCostSaved": 0,
  "storageUsedMB": 0
}
```

### 3. API Integration Verification

Test that existing APIs work with cache:

```bash
# Test test generation (should work normally)
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lectureIds":["uuid"],"questionsCount":5}' \
  http://localhost:3001/api/tests/generate

# Response should include cache metadata:
{
  "questions": [...],
  "cached": false,
  "tokensUsed": 150
}
```

### 4. Cache Hit Verification

Test cache hit functionality:

```bash
# Make same request twice
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"lectureIds":["uuid"],"questionsCount":5}' \
  http://localhost:3001/api/tests/generate

# Second request should show:
{
  "questions": [...],
  "cached": true,
  "cachedAt": "2024-01-15T10:30:00Z",
  "tokensSaved": 150
}
```

## Monitoring Setup

### 1. Log Monitoring

Set up monitoring for cache-related logs:

```bash
# Monitor cache operations
tail -f logs/app.log | grep -E "(CACHE HIT|CACHE MISS|CACHE STORED)"

# Expected log entries:
# ✅ CACHE HIT - Key: a1b2c3... | Tokens Saved: 1250
# ❌ CACHE MISS - Key: d4e5f6... | Will call API
# 💾 CACHE STORED - Key: g7h8i9... | Size: 2.3KB
```

### 2. Performance Monitoring

Monitor cache performance metrics:

```bash
# Create monitoring script
cat > monitor_cache.sh << 'EOF'
#!/bin/bash
while true; do
  echo "=== Cache Stats $(date) ==="
  curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
    http://localhost:3001/api/cache/stats | jq '.'
  echo ""
  sleep 300  # Check every 5 minutes
done
EOF

chmod +x monitor_cache.sh
./monitor_cache.sh
```

### 3. Error Monitoring

Set up alerts for cache errors:

```bash
# Monitor for cache errors
tail -f logs/app.log | grep -i "cache.*error" | while read line; do
  echo "ALERT: Cache error detected: $line"
  # Send notification (email, Slack, etc.)
done
```

## Performance Optimization

### 1. Database Optimization

Ensure cache queries are optimized:

```sql
-- Check index usage
EXPLAIN ANALYZE 
SELECT * FROM ai_response_cache 
WHERE cache_key = 'sample_key';

-- Should use idx_ai_cache_key index

-- Check query performance
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE tablename = 'ai_response_cache';
```

### 2. Memory Usage

Monitor memory usage with cache enabled:

```bash
# Check Node.js memory usage
curl http://localhost:3001/api/health/memory

# Monitor system memory
free -h
top -p $(pgrep node)
```

### 3. Cache Size Management

Set up automatic cache cleanup:

```bash
# Add to crontab for daily cleanup
0 2 * * * curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3001/api/cache/old?days=30"
```

## Troubleshooting

### Common Issues

**1. Cache not working (always cache miss)**

```bash
# Check cache service initialization
curl http://localhost:3001/api/cache/stats

# Check environment variables
echo $CACHE_ENABLED

# Check logs for cache errors
grep -i "cache.*error" logs/app.log
```

**2. Database connection errors**

```bash
# Test database connectivity
node -e "
const { createClient } = require('@supabase/supabase-js');
const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
client.from('ai_response_cache').select('count').then(console.log);
"
```

**3. High memory usage**

```bash
# Check cache table size
psql "postgresql://..." -c "
SELECT 
  COUNT(*) as entries,
  pg_size_pretty(pg_total_relation_size('ai_response_cache')) as size
FROM ai_response_cache;
"

# Clear cache if needed
curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/api/cache/all
```

**4. API responses missing cache metadata**

```bash
# Check if routes are properly updated
grep -r "cached:" backend/src/routes/

# Verify cache service is being called
grep -r "getCachedResponse" backend/src/routes/
```

### Debug Mode

Enable debug mode for detailed cache logging:

```bash
# Set debug environment variable
export DEBUG_CACHE=true

# Restart server
pm2 restart backend

# Monitor debug logs
tail -f logs/app.log | grep "DEBUG.*CACHE"
```

## Rollback Procedures

If issues occur, you can rollback the deployment:

### 1. Quick Rollback (Disable Cache)

```bash
# Disable cache without code changes
export CACHE_ENABLED=false
pm2 restart backend

# Verify cache is disabled
curl http://localhost:3001/api/health
```

### 2. Code Rollback

```bash
# Stop server
pm2 stop backend

# Restore from backup
tar -xzf backend_backup_20240115_143000.tar.gz

# Or revert git changes
git reset --hard pre-cache-deployment

# Restart server
pm2 start backend
```

### 3. Database Rollback

```bash
# Drop cache tables if needed (last resort)
psql "postgresql://..." -c "
DROP TABLE IF EXISTS ai_cache_stats CASCADE;
DROP TABLE IF EXISTS lecture_content_hashes CASCADE;
DROP TABLE IF EXISTS ai_response_cache CASCADE;
"
```

## Success Criteria

The deployment is successful when:

- ✅ Server starts without errors
- ✅ Health check returns cache status
- ✅ Cache statistics API works
- ✅ Test generation shows cache metadata
- ✅ Second identical request shows cache hit
- ✅ Cache management APIs work
- ✅ No performance degradation on existing APIs
- ✅ Logs show cache operations

## Maintenance

### Daily Tasks

- Monitor cache hit rates (target >50%)
- Check cache table size growth
- Review error logs for cache issues

### Weekly Tasks

- Analyze cache performance metrics
- Clean up old cache entries if needed
- Review and adjust cache settings

### Monthly Tasks

- Analyze cost savings from cache
- Optimize cache cleanup schedules
- Review cache key generation efficiency

## Support

For deployment issues:

1. **Check logs**: Review application logs for specific errors
2. **Verify environment**: Ensure all environment variables are set
3. **Test connectivity**: Verify database and API connectivity
4. **Monitor metrics**: Check cache statistics and performance
5. **Contact support**: Provide deployment logs and error messages

The cache system is now ready for production use!