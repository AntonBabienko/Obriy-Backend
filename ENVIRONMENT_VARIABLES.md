# Environment Variables Documentation

This document describes all environment variables used in the backend application.

## Required Variables

### Server Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `PORT` | Server port number | `3001` | Yes |
| `NODE_ENV` | Node.js environment | `development`, `production` | Yes |
| `CORS_ORIGIN` | Allowed CORS origin | `http://localhost:5173` | Yes |

### Database Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `SUPABASE_URL` | Supabase project URL | `https://your-project.supabase.co` | Yes |
| `SUPABASE_ANON_KEY` | Supabase anonymous key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Yes |
| `SUPABASE_SERVICE_KEY` | Supabase service role key | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...` | Yes |

### AI API Configuration

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `GEMINI_API_KEY` | Primary Gemini API key | `AIzaSyC...` | Yes |
| `GEMINI_API_KEY_2` | Secondary Gemini API key (rotation) | `AIzaSyD...` | No |
| `GEMINI_API_KEY_3` | Third Gemini API key (rotation) | `AIzaSyE...` | No |
| `GEMINI_API_KEY_4` | Fourth Gemini API key (rotation) | `AIzaSyF...` | No |
| `GEMINI_API_KEY_5` | Fifth Gemini API key (rotation) | `AIzaSyG...` | No |

**Note**: Multiple Gemini API keys enable automatic rotation to bypass Free Tier limits (1M tokens/minute per key).

## Optional Variables

### Legacy API Keys

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `GROQ_API_KEY` | Groq API key (deprecated) | `gsk_...` | No |
| `OPENAI_API_KEY` | OpenAI API key (not needed) | `sk-...` | No |

**Note**: These are kept for backward compatibility but not actively used.

## AI Response Cache Configuration

### Cache Control

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `CACHE_ENABLED` | Enable/disable caching system | `true` | `true`, `false` |
| `DEBUG_CACHE` | Enable cache debug logging | `false` | `true`, `false` |

### Cache Cleanup

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `CACHE_CLEANUP_DAYS` | Days after which cache entries are considered old | `30` | `30`, `60`, `90` |
| `CACHE_CLEANUP_INTERVAL_HOURS` | Hours between automatic cleanup runs | `24` | `24`, `12`, `6` |

### Cache Limits

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `CACHE_MAX_ENTRIES` | Maximum number of cache entries | `10000` | `5000`, `10000`, `20000` |
| `CACHE_MAX_SIZE_MB` | Maximum cache size in megabytes | `500` | `100`, `500`, `1000` |

## Environment-Specific Configurations

### Development Environment

```bash
NODE_ENV=development
PORT=3001
DEBUG_CACHE=true
CACHE_CLEANUP_DAYS=7
CACHE_CLEANUP_INTERVAL_HOURS=6
```

### Production Environment

```bash
NODE_ENV=production
PORT=8080
DEBUG_CACHE=false
CACHE_CLEANUP_DAYS=30
CACHE_CLEANUP_INTERVAL_HOURS=24
CACHE_MAX_ENTRIES=20000
CACHE_MAX_SIZE_MB=1000
```

### Testing Environment

```bash
NODE_ENV=test
PORT=3002
CACHE_ENABLED=false
DEBUG_CACHE=true
```

## Cache Configuration Details

### CACHE_ENABLED

Controls whether the AI response caching system is active.

- **`true`**: Cache is enabled, responses are stored and retrieved
- **`false`**: Cache is disabled, all requests go directly to AI APIs

**Use Cases**:
- Disable during development/debugging
- Disable if cache causes issues
- Disable for testing fresh responses

### DEBUG_CACHE

Enables detailed logging of cache operations.

- **`true`**: Logs cache hits, misses, key generation, and operations
- **`false`**: Only logs errors and warnings

**Log Examples**:
```
✅ CACHE HIT - Key: a1b2c3... | Tokens Saved: 1250
❌ CACHE MISS - Key: d4e5f6... | Will call API
💾 CACHE STORED - Key: g7h8i9... | Size: 2.3KB
```

### CACHE_CLEANUP_DAYS

Defines how long cache entries are kept before automatic cleanup.

**Considerations**:
- **Shorter periods** (7-14 days): Less storage, more API calls
- **Longer periods** (30-90 days): More storage, better hit rates
- **Very long periods** (>90 days): Risk of stale content

### CACHE_CLEANUP_INTERVAL_HOURS

How often the automatic cleanup process runs.

**Recommendations**:
- **Development**: 6 hours (faster iteration)
- **Production**: 24 hours (daily cleanup)
- **High-traffic**: 12 hours (more frequent cleanup)

### CACHE_MAX_ENTRIES

Maximum number of cache entries before forced cleanup.

**Sizing Guidelines**:
- **Small deployment**: 5,000 entries (~50MB)
- **Medium deployment**: 10,000 entries (~100MB)
- **Large deployment**: 20,000+ entries (~200MB+)

### CACHE_MAX_SIZE_MB

Maximum total cache size in megabytes.

**Storage Planning**:
- Average cache entry: ~10KB
- 1,000 entries ≈ 10MB
- 10,000 entries ≈ 100MB
- Monitor actual usage and adjust

## Security Considerations

### API Keys

- **Never commit API keys** to version control
- **Use different keys** for different environments
- **Rotate keys regularly** for security
- **Monitor API usage** for unexpected spikes

### Database Keys

- **Service role key** has full database access - protect carefully
- **Anonymous key** is safe to expose in frontend
- **Use RLS policies** to restrict data access

### Cache Security

- **Cache entries** don't contain sensitive user data
- **Access control** is handled at API level
- **Automatic cleanup** prevents data accumulation

## Troubleshooting

### Common Issues

**Cache not working**:
```bash
# Check if cache is enabled
echo $CACHE_ENABLED

# Enable debug logging
export DEBUG_CACHE=true

# Check logs
tail -f logs/app.log | grep CACHE
```

**High memory usage**:
```bash
# Reduce cache limits
export CACHE_MAX_ENTRIES=5000
export CACHE_MAX_SIZE_MB=100

# Force cleanup
curl -X DELETE http://localhost:3001/api/cache/old?days=7
```

**API key rotation issues**:
```bash
# Test each key individually
export GEMINI_API_KEY=your_key_1
curl -X POST http://localhost:3001/api/tests/generate

export GEMINI_API_KEY=your_key_2
curl -X POST http://localhost:3001/api/tests/generate
```

### Environment Validation

The application validates required environment variables on startup:

```javascript
// Required variables check
const required = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY', 
  'SUPABASE_SERVICE_KEY',
  'GEMINI_API_KEY'
];

required.forEach(key => {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
});
```

### Health Check

Use the health check endpoint to verify configuration:

```bash
curl http://localhost:3001/health
```

Response includes:
- Database connectivity
- API key validation
- Cache system status
- Environment configuration

## Migration Guide

### From Non-Cached to Cached

1. **Add cache variables** to `.env`
2. **Run database migrations** for cache tables
3. **Deploy updated code** with cache enabled
4. **Monitor performance** and hit rates
5. **Adjust settings** based on usage patterns

### Cache Settings Migration

When updating cache settings:

1. **Update environment variables**
2. **Restart application** to pick up changes
3. **Monitor logs** for configuration changes
4. **Clear cache if needed** for immediate effect

## Best Practices

### Development

- Use shorter cleanup intervals for faster iteration
- Enable debug logging to understand cache behavior
- Use smaller cache limits to prevent resource issues
- Test with cache disabled to verify fallback behavior

### Production

- Use longer cleanup intervals for stability
- Disable debug logging for performance
- Set appropriate cache limits based on server resources
- Monitor cache hit rates and adjust settings accordingly

### Monitoring

- Track cache hit rates (target >50%)
- Monitor storage usage and growth
- Set up alerts for cache errors
- Review cleanup frequency and effectiveness

## Support

For environment variable issues:

1. **Verify syntax** - no spaces around `=`
2. **Check quotes** - avoid unnecessary quotes
3. **Validate values** - ensure correct format
4. **Test connectivity** - verify API keys and database access
5. **Check logs** - review startup messages for errors