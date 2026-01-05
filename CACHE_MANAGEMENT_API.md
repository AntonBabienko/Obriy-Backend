# Cache Management API Implementation

## Overview

This document describes the cache management API endpoints that have been implemented for the AI Response Caching system.

## Endpoints

### 1. GET /api/cache/stats

**Description:** Get comprehensive cache statistics

**Authentication:** Required (admin only)

**Requirements:** 3.1, 8.5

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEntries": 150,
    "totalHits": 450,
    "totalMisses": 100,
    "hitRate": 81.82,
    "tokensSaved": 125000,
    "estimatedCostSaved": 0.009375,
    "storageUsed": 2500000,
    "oldestEntry": "2025-11-01T10:00:00.000Z",
    "newestEntry": "2025-12-07T16:00:00.000Z"
  }
}
```

**Example:**
```bash
curl -X GET http://localhost:8080/api/cache/stats \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### 2. DELETE /api/cache/lecture/:lectureId

**Description:** Invalidate all cache entries for a specific lecture

**Authentication:** Required (teacher/admin)

**Requirements:** 3.2

**Parameters:**
- `lectureId` (path parameter) - UUID of the lecture

**Response:**
```json
{
  "success": true,
  "message": "Кеш для лекції успішно очищено",
  "data": {
    "lectureId": "123e4567-e89b-12d3-a456-426614174000",
    "deletedEntries": 5
  }
}
```

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/cache/lecture/123e4567-e89b-12d3-a456-426614174000 \
  -H "Authorization: Bearer YOUR_TEACHER_TOKEN"
```

---

### 3. DELETE /api/cache/old

**Description:** Clear cache entries older than specified days

**Authentication:** Required (admin only)

**Requirements:** 3.3

**Query Parameters:**
- `days` (optional, default: 30) - Age threshold in days

**Response:**
```json
{
  "success": true,
  "message": "Старий кеш успішно очищено",
  "data": {
    "olderThanDays": 30,
    "deletedEntries": 25
  }
}
```

**Examples:**
```bash
# Clear cache older than 30 days (default)
curl -X DELETE http://localhost:8080/api/cache/old \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Clear cache older than 7 days
curl -X DELETE "http://localhost:8080/api/cache/old?days=7" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

### 4. DELETE /api/cache/all

**Description:** Clear all cache entries

**Authentication:** Required (admin only)

**Requirements:** 3.4

**Request Body:**
```json
{
  "confirm": "DELETE_ALL_CACHE"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Весь кеш успішно очищено"
}
```

**Example:**
```bash
curl -X DELETE http://localhost:8080/api/cache/all \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": "DELETE_ALL_CACHE"}'
```

**Note:** This endpoint requires explicit confirmation to prevent accidental deletion. You must send `{"confirm": "DELETE_ALL_CACHE"}` in the request body.

---

## Error Responses

All endpoints return error responses in the following format:

```json
{
  "success": false,
  "message": "Error description in Ukrainian",
  "error": "Technical error message"
}
```

**Common HTTP Status Codes:**
- `200` - Success
- `400` - Bad Request (invalid parameters, missing confirmation)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `500` - Internal Server Error

---

## Authentication & Authorization

### Role Requirements

| Endpoint | Required Role(s) |
|----------|-----------------|
| GET /api/cache/stats | admin |
| DELETE /api/cache/lecture/:lectureId | teacher, admin |
| DELETE /api/cache/old | admin |
| DELETE /api/cache/all | admin |

### How to Authenticate

Include the JWT token in the Authorization header:

```
Authorization: Bearer YOUR_JWT_TOKEN
```

---

## Implementation Details

### Files Created/Modified

1. **Created:** `backend/src/routes/cache.routes.ts`
   - Implements all 4 cache management endpoints
   - Includes authentication and authorization middleware
   - Provides comprehensive error handling

2. **Modified:** `backend/src/server.ts`
   - Added import for cache routes
   - Registered cache routes at `/api/cache`

3. **Created:** `backend/src/test/cacheRoutes.test.ts`
   - Integration tests for all endpoints
   - Tests service layer functionality
   - Validates authentication requirements

### Service Layer

All endpoints use the `AICacheService` class from `backend/src/services/aiCache.ts`:

- `getCacheStats()` - Retrieves cache statistics
- `invalidateLectureCache(lectureId)` - Deletes cache for a lecture
- `clearOldCache(days)` - Removes old cache entries
- `clearAllCache()` - Clears all cache

---

## Testing

Run the cache routes tests:

```bash
cd backend
npm test -- --run cacheRoutes.test.ts
```

All 12 tests should pass:
- ✓ Service layer tests (6)
- ✓ Endpoint requirements tests (6)

---

## Usage Examples

### Monitor Cache Performance

```bash
# Get current cache statistics
curl -X GET http://localhost:8080/api/cache/stats \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Clear Cache for Updated Lecture

```bash
# After updating a lecture, clear its cache
curl -X DELETE http://localhost:8080/api/cache/lecture/$LECTURE_ID \
  -H "Authorization: Bearer $TEACHER_TOKEN"
```

### Routine Maintenance

```bash
# Clear cache older than 90 days
curl -X DELETE "http://localhost:8080/api/cache/old?days=90" \
  -H "Authorization: Bearer $ADMIN_TOKEN"
```

### Emergency Cache Clear

```bash
# Clear all cache (requires confirmation)
curl -X DELETE http://localhost:8080/api/cache/all \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"confirm": "DELETE_ALL_CACHE"}'
```

---

## Next Steps

The following tasks remain in the AI Response Caching implementation:

- [ ] 10. Add automatic cache invalidation on content changes
- [ ] 11. Add frontend cache indicators
- [ ] 12. Testing and validation
- [ ] 13. Documentation and deployment
- [ ] 14. Checkpoint - Verify cache system working

---

## Notes

- All endpoints include proper error handling and logging
- The `/api/cache/all` endpoint requires explicit confirmation to prevent accidental data loss
- Cache statistics depend on the `get_cache_stats` database function (may need to be created)
- All operations are logged with emoji indicators for easy monitoring:
  - 🗑️ Cache invalidation/cleanup
  - ✅ Cache hit
  - ❌ Cache miss
  - 💾 Cache stored
