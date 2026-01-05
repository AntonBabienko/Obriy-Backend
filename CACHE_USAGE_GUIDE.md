# AI Response Cache Usage Guide

## Overview

The AI Response Cache system automatically stores and reuses AI-generated responses to reduce API calls to Gemini and improve response times. This guide explains how to use the caching system effectively.

## How It Works

1. **Cache Check**: Before making any AI API call, the system generates a unique cache key and checks if a response already exists
2. **Cache Hit**: If found, returns the cached response immediately (typically <50ms)
3. **Cache Miss**: If not found, calls the Gemini API, stores the response, and returns it
4. **Auto-Invalidation**: Cache is automatically invalidated when lecture content changes

## API Endpoints

### Test Generation with Cache

**Endpoint**: `POST /api/tests/generate`

**Request Body**:
```json
{
  "lectureIds": ["uuid1", "uuid2"],
  "questionsCount": 10,
  "forceRefresh": false
}
```

**Response**:
```json
{
  "questions": [...],
  "cached": true,
  "cachedAt": "2024-01-15T10:30:00Z",
  "tokensSaved": 1250
}
```

**Parameters**:
- `forceRefresh`: Set to `true` to bypass cache and generate fresh content

### AI Chat with Cache

**Endpoint**: `POST /api/ai/chat`

**Request Body**:
```json
{
  "lectureId": "uuid",
  "query": "Explain the main concepts",
  "forceRefresh": false
}
```

**Response**:
```json
{
  "response": "...",
  "cached": true,
  "cachedAt": "2024-01-15T10:30:00Z",
  "tokensSaved": 800
}
```

### Summary Generation with Cache

**Endpoint**: `POST /api/ai/summary`

**Request Body**:
```json
{
  "lectureId": "uuid",
  "forceRefresh": false
}
```

**Response**:
```json
{
  "summary": "...",
  "cached": false,
  "tokensUsed": 600
}
```

## Cache Management API

### Get Cache Statistics

**Endpoint**: `GET /api/cache/stats`
**Auth**: Admin only

**Response**:
```json
{
  "totalEntries": 1250,
  "totalRequests": 2000,
  "cacheHits": 750,
  "cacheMisses": 1250,
  "hitRate": 37.5,
  "tokensSaved": 125000,
  "estimatedCostSaved": 9.38,
  "storageUsedMB": 45.2,
  "oldestEntry": "2024-01-10T08:00:00Z",
  "newestEntry": "2024-01-15T14:30:00Z"
}
```

### Clear Cache for Specific Lecture

**Endpoint**: `DELETE /api/cache/lecture/:lectureId`
**Auth**: Teacher/Admin

**Response**:
```json
{
  "message": "Cache cleared for lecture",
  "entriesDeleted": 15
}
```

### Clear Old Cache Entries

**Endpoint**: `DELETE /api/cache/old?days=30`
**Auth**: Admin only

**Response**:
```json
{
  "message": "Old cache entries cleared",
  "entriesDeleted": 245
}
```

### Clear All Cache

**Endpoint**: `DELETE /api/cache/all`
**Auth**: Admin only

**Response**:
```json
{
  "message": "All cache cleared",
  "entriesDeleted": 1250
}
```

## Cache Key Generation

Cache keys are generated using a deterministic algorithm that combines:

1. **Operation Type**: `test_generation`, `chat`, `summary`
2. **Lecture IDs**: Sorted array of lecture UUIDs
3. **Parameters**: Sorted JSON of request parameters
4. **Content Hash**: SHA-256 hash of lecture content

**Example**:
```
operation_type: "test_generation"
lecture_ids: ["uuid1", "uuid2"] (sorted)
params: {"questionsCount": 10}
content_hash: "a1b2c3d4..."

Cache Key: SHA-256("test_generation|uuid1,uuid2|{\"questionsCount\":10}|a1b2c3d4...")
```

## Frontend Integration

### Cache Indicators

The UI shows cache status with visual indicators:

- **⚡ From Cache** - Response was served from cache
- **🔄 Generated** - Fresh response from AI API
- **Force Refresh** - Checkbox to bypass cache

### Cache Metadata

Responses include metadata about caching:

```typescript
interface CacheMetadata {
  cached: boolean;
  cachedAt?: string;
  tokensSaved?: number;
  tokensUsed?: number;
}
```

## Best Practices

### When to Use Force Refresh

- **Content Updates**: After updating lecture content (auto-handled)
- **Different Variations**: When you want different question variations
- **Testing**: During development and testing
- **User Request**: When users specifically want fresh content

### Cache Optimization

1. **Consistent Parameters**: Use the same parameter names and values for better cache hits
2. **Batch Operations**: Process multiple lectures together when possible
3. **Content Stability**: Avoid frequent minor content changes that invalidate cache

### Monitoring

1. **Hit Rate**: Aim for >50% hit rate in production
2. **Storage Growth**: Monitor cache size and clean old entries
3. **Cost Savings**: Track token savings and estimated cost reduction

## Content Change Detection

The system automatically detects when lecture content changes:

1. **Content Hash**: SHA-256 hash generated for each lecture
2. **Hash Comparison**: Stored hash compared with current content
3. **Auto-Invalidation**: Mismatched hashes trigger cache invalidation
4. **Fresh Generation**: New content generates fresh AI responses

## Error Handling

### Cache Failures

If cache operations fail, the system:

1. **Logs the Error**: All cache errors are logged for monitoring
2. **Continues Operation**: Never blocks API requests due to cache issues
3. **Falls Back**: Calls AI API directly if cache unavailable
4. **Graceful Degradation**: Returns responses without cache metadata

### Common Issues

**Cache Miss on Expected Hit**:
- Check if content was recently updated
- Verify parameters are identical
- Check if cache was manually cleared

**High Cache Miss Rate**:
- Review parameter consistency
- Check for frequent content updates
- Monitor force refresh usage

**Storage Growth**:
- Implement regular cleanup of old entries
- Monitor cache size in admin panel
- Adjust TTL if needed

## Troubleshooting

### Debug Cache Keys

To debug cache key generation:

```bash
# Enable debug logging
export DEBUG_CACHE=true

# Check logs for cache key generation
tail -f logs/app.log | grep "CACHE_KEY"
```

### Verify Cache Status

```bash
# Check cache statistics
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  http://localhost:3001/api/cache/stats

# Check specific lecture cache
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/cache/lecture/uuid
```

### Clear Problematic Cache

```bash
# Clear cache for specific lecture
curl -X DELETE \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3001/api/cache/lecture/uuid

# Force refresh in next request
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"lectureIds":["uuid"],"forceRefresh":true}' \
  http://localhost:3001/api/tests/generate
```

### Database Queries

Check cache directly in database:

```sql
-- View cache entries for lecture
SELECT cache_key, operation_type, hit_count, created_at 
FROM ai_response_cache 
WHERE 'lecture-uuid' = ANY(lecture_ids);

-- Check cache statistics
SELECT 
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry
FROM ai_response_cache;

-- Find large cache entries
SELECT cache_key, operation_type, content_size, tokens_used
FROM ai_response_cache 
ORDER BY content_size DESC 
LIMIT 10;
```

## Performance Metrics

### Expected Performance

- **Cache Hit Response**: <50ms
- **Cache Miss Response**: 2-5 seconds (Gemini API time)
- **Hit Rate Target**: >50% in production
- **Storage Efficiency**: ~1MB per 100 cached responses

### Monitoring Queries

```sql
-- Daily hit rate
SELECT 
  date,
  cache_hits,
  cache_misses,
  ROUND(cache_hits::float / (cache_hits + cache_misses) * 100, 2) as hit_rate
FROM ai_cache_stats 
ORDER BY date DESC;

-- Token savings over time
SELECT 
  date,
  tokens_saved,
  tokens_saved * 0.075 / 1000000 as estimated_cost_saved_usd
FROM ai_cache_stats 
ORDER BY date DESC;
```

## Security Considerations

### Access Control

- **Cache Statistics**: Admin only
- **Cache Management**: Admin only (except lecture-specific clearing)
- **Force Refresh**: Available to all authenticated users
- **Cache Viewing**: Users can only see their own cached responses

### Data Privacy

- **No Personal Data**: Cache only stores AI responses, not user queries
- **Automatic Cleanup**: Old entries are automatically removed
- **Secure Storage**: All cache data encrypted at rest in database

### Rate Limiting

Cache operations respect the same rate limits as regular API calls to prevent abuse.

## Migration and Deployment

### Database Setup

1. **Run Migrations**: Apply cache table migrations
2. **Verify Indexes**: Ensure all indexes are created
3. **Test Queries**: Verify cache queries perform well

### Monitoring Setup

1. **Log Monitoring**: Set up alerts for cache errors
2. **Performance Monitoring**: Track hit rates and response times
3. **Storage Monitoring**: Monitor cache table size growth

### Rollback Plan

If issues occur:

1. **Disable Caching**: Set environment variable to bypass cache
2. **Clear Cache**: Use admin API to clear all cache
3. **Revert Code**: Deploy previous version without cache
4. **Database Rollback**: Drop cache tables if needed

## Support

For issues with the cache system:

1. **Check Logs**: Review application logs for cache errors
2. **Monitor Metrics**: Check hit rates and performance in admin panel
3. **Clear Cache**: Try clearing cache for affected lectures
4. **Force Refresh**: Use force refresh to bypass cache temporarily
5. **Contact Support**: Provide cache key and error logs for debugging