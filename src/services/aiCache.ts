import crypto from 'crypto';
import { supabase } from '../config/supabase';

/**
 * Type definitions for AI Cache Service
 */

export type OperationType =
    | 'test_generation'
    | 'quiz'
    | 'chat'
    | 'summary'
    | 'flashcards'
    | 'mindmap'
    | 'ukrainian-educational';

export interface CacheKey {
    operationType: OperationType;
    lectureIds: string[];
    params: Record<string, any>;
    contentHash: string;
}

export interface CachedResponse {
    id: string;
    cache_key: string;
    operation_type: string;
    lecture_ids: string[];
    params: Record<string, any>;
    content_hash: string;
    response_data: any;
    tokens_used: number;
    content_size: number;
    hit_count: number;
    created_at: string;
    last_accessed_at: string;
}

export interface CacheStats {
    totalEntries: number;
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    tokensSaved: number;
    estimatedCostSaved: number;
    storageUsed: number;
    oldestEntry: Date | null;
    newestEntry: Date | null;
}

/**
 * AI Cache Service
 * 
 * Manages caching of AI responses to reduce API calls and improve performance.
 * Implements cache key generation, storage, retrieval, and invalidation.
 */
export class AICacheService {
    /**
     * Generate unique cache key from request parameters
     * 
     * Uses deterministic algorithm to ensure same parameters always produce same key.
     * Sorts lecture IDs and param keys for consistency.
     * 
     * @param key - Cache key components
     * @returns SHA-256 hash as hex string (64 characters)
     */
    generateCacheKey(key: CacheKey): string {
        // Validate input
        if (!key.operationType) {
            throw new Error('operationType is required');
        }
        if (!Array.isArray(key.lectureIds) || key.lectureIds.length === 0) {
            throw new Error('lectureIds must be a non-empty array');
        }
        if (!key.contentHash) {
            throw new Error('contentHash is required');
        }

        // Sort lecture IDs for consistency
        const sortedLectureIds = [...key.lectureIds].sort();

        // Stringify params in deterministic way (sorted keys)
        const sortedParams = key.params || {};
        const paramsString = JSON.stringify(
            sortedParams,
            Object.keys(sortedParams).sort()
        );

        // Combine all components with delimiter
        const keyString = [
            key.operationType,
            sortedLectureIds.join(','),
            paramsString,
            key.contentHash
        ].join('|');

        // Generate SHA-256 hash
        return crypto
            .createHash('sha256')
            .update(keyString)
            .digest('hex');
    }

    /**
     * Get cached response by cache key
     * 
     * Queries the cache and updates hit_count and last_accessed_at on cache hit.
     * Returns null on cache miss. Includes error handling with fallback.
     * Tracks cache hit/miss statistics in ai_cache_stats table.
     * 
     * @param cacheKey - The cache key to lookup
     * @returns Cached response or null if not found
     */
    async getCachedResponse(cacheKey: string): Promise<CachedResponse | null> {
        try {
            // Query cache by key
            const { data, error } = await supabase
                .from('ai_response_cache')
                .select('*')
                .eq('cache_key', cacheKey)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - cache miss
                    // Track cache miss in statistics
                    await this.trackCacheStats(false, 0);
                    return null;
                }
                throw error;
            }

            if (!data) {
                // Track cache miss in statistics
                await this.trackCacheStats(false, 0);
                return null;
            }

            // Update hit count and last accessed time
            const { error: updateError } = await supabase
                .from('ai_response_cache')
                .update({
                    hit_count: data.hit_count + 1,
                    last_accessed_at: new Date().toISOString()
                })
                .eq('cache_key', cacheKey);

            if (updateError) {
                // Log error but don't fail the request
                console.error('Error updating cache hit count:', updateError);
            }

            // Track cache hit in statistics with tokens saved
            await this.trackCacheStats(true, data.tokens_used);

            return data as CachedResponse;
        } catch (error) {
            // Log error and return null (treat as cache miss)
            console.error('Error getting cached response:', error);
            // Track as cache miss
            await this.trackCacheStats(false, 0);
            return null;
        }
    }

    /**
     * Store response in cache
     * 
     * Inserts new cache entry with all required fields.
     * Handles duplicate key conflicts using upsert.
     * Stores response_data as JSONB.
     * Includes error handling with logging.
     * 
     * @param cacheKey - Unique cache key
     * @param operationType - Type of AI operation
     * @param lectureIds - Array of lecture IDs
     * @param params - Request parameters
     * @param contentHash - Hash of lecture content
     * @param responseData - AI response to cache
     * @param tokensUsed - Number of tokens used
     * @param contentSize - Size of content in bytes
     */
    async cacheResponse(
        cacheKey: string,
        operationType: OperationType,
        lectureIds: string[],
        params: Record<string, any>,
        contentHash: string,
        responseData: any,
        tokensUsed: number,
        contentSize: number
    ): Promise<void> {
        try {
            // Insert or update cache entry (upsert)
            const { error } = await supabase
                .from('ai_response_cache')
                .upsert({
                    cache_key: cacheKey,
                    operation_type: operationType,
                    lecture_ids: lectureIds,
                    params: params,
                    content_hash: contentHash,
                    response_data: responseData,
                    tokens_used: tokensUsed,
                    content_size: contentSize,
                    hit_count: 0,
                    created_at: new Date().toISOString(),
                    last_accessed_at: new Date().toISOString()
                }, {
                    onConflict: 'cache_key'
                });

            if (error) {
                throw error;
            }

            console.log('💾 CACHE STORED', {
                cacheKey,
                operationType,
                tokensUsed,
                contentSize
            });
        } catch (error) {
            // Log error but don't fail the request
            console.error('Error caching response:', error);
            // Don't throw - caching failure shouldn't break the API response
        }
    }

    /**
     * Invalidate all cache entries for a specific lecture
     * 
     * Deletes all cache entries containing the lecture_id.
     * Uses GIN index for efficient array search.
     * 
     * @param lectureId - UUID of the lecture
     * @returns Number of entries deleted
     */
    async invalidateLectureCache(lectureId: string): Promise<number> {
        try {
            // Delete all cache entries containing this lecture_id
            // The @> operator uses the GIN index for efficient array search
            const { data, error } = await supabase
                .from('ai_response_cache')
                .delete()
                .contains('lecture_ids', [lectureId])
                .select();

            if (error) {
                throw error;
            }

            const deletedCount = data?.length || 0;

            console.log('🗑️ CACHE INVALIDATED', {
                lectureId,
                reason: 'lecture_invalidation',
                entriesRemoved: deletedCount
            });

            return deletedCount;
        } catch (error) {
            console.error('Error invalidating lecture cache:', error);
            throw error;
        }
    }

    /**
     * Invalidate cache entries with mismatched content hash
     * 
     * Finds entries containing the lecture_id with a different content_hash
     * and deletes them. This is used when lecture content changes.
     * 
     * @param lectureId - UUID of the lecture
     * @param newContentHash - New content hash
     * @returns Number of entries deleted
     */
    async invalidateByContentHash(lectureId: string, newContentHash: string): Promise<number> {
        try {
            // Find and delete cache entries containing this lecture_id
            // with a content_hash that doesn't match the new hash
            const { data, error } = await supabase
                .from('ai_response_cache')
                .delete()
                .contains('lecture_ids', [lectureId])
                .neq('content_hash', newContentHash)
                .select();

            if (error) {
                throw error;
            }

            const deletedCount = data?.length || 0;

            console.log('🗑️ CACHE INVALIDATED BY CONTENT HASH', {
                lectureId,
                newContentHash,
                reason: 'content_hash_mismatch',
                entriesRemoved: deletedCount
            });

            return deletedCount;
        } catch (error) {
            console.error('Error invalidating cache by content hash:', error);
            throw error;
        }
    }

    /**
     * Clear cache entries older than specified days
     * 
     * Deletes entries older than the specified number of days.
     * Uses created_at index for efficient query.
     * 
     * @param olderThanDays - Age threshold in days
     * @returns Number of entries deleted
     */
    async clearOldCache(olderThanDays: number): Promise<number> {
        try {
            // Calculate the cutoff date
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

            // Delete all cache entries older than cutoff date
            const { data, error } = await supabase
                .from('ai_response_cache')
                .delete()
                .lt('created_at', cutoffDate.toISOString())
                .select();

            if (error) {
                throw error;
            }

            const deletedCount = data?.length || 0;

            console.log('🗑️ OLD CACHE CLEARED', {
                olderThanDays,
                cutoffDate: cutoffDate.toISOString(),
                entriesRemoved: deletedCount
            });

            return deletedCount;
        } catch (error) {
            console.error('Error clearing old cache:', error);
            throw error;
        }
    }

    /**
     * Get cache statistics
     * 
     * Calculates comprehensive cache statistics including:
     * - Total entries in cache
     * - Total hits and misses from ai_cache_stats table
     * - Hit rate percentage
     * - Tokens saved and estimated cost savings
     * - Storage used
     * - Oldest and newest cache entries
     * 
     * @returns Cache statistics object
     */
    async getCacheStats(): Promise<CacheStats> {
        try {
            // Get total entries count
            const { count: totalEntries, error: countError } = await supabase
                .from('ai_response_cache')
                .select('*', { count: 'exact', head: true });

            if (countError) {
                throw countError;
            }

            // Get aggregated stats from ai_cache_stats table (last 30 days)
            const { data: statsData, error: statsError } = await supabase
                .rpc('get_cache_stats');

            if (statsError) {
                throw statsError;
            }

            const stats = statsData?.[0] || {
                total_requests: 0,
                total_hits: 0,
                total_misses: 0,
                hit_rate: 0,
                total_tokens_saved: 0,
                estimated_cost_saved: 0
            };

            // Calculate storage used (sum of content_size)
            const { data: storageData, error: storageError } = await supabase
                .from('ai_response_cache')
                .select('content_size');

            if (storageError) {
                throw storageError;
            }

            const storageUsed = storageData?.reduce((sum, entry) => sum + (entry.content_size || 0), 0) || 0;

            // Get oldest and newest entries
            const { data: oldestData, error: oldestError } = await supabase
                .from('ai_response_cache')
                .select('created_at')
                .order('created_at', { ascending: true })
                .limit(1);

            if (oldestError) {
                throw oldestError;
            }

            const { data: newestData, error: newestError } = await supabase
                .from('ai_response_cache')
                .select('created_at')
                .order('created_at', { ascending: false })
                .limit(1);

            if (newestError) {
                throw newestError;
            }

            return {
                totalEntries: totalEntries || 0,
                totalHits: Number(stats.total_hits) || 0,
                totalMisses: Number(stats.total_misses) || 0,
                hitRate: Number(stats.hit_rate) || 0,
                tokensSaved: Number(stats.total_tokens_saved) || 0,
                estimatedCostSaved: Number(stats.estimated_cost_saved) || 0,
                storageUsed: storageUsed,
                oldestEntry: oldestData?.[0]?.created_at ? new Date(oldestData[0].created_at) : null,
                newestEntry: newestData?.[0]?.created_at ? new Date(newestData[0].created_at) : null
            };
        } catch (error) {
            console.error('Error getting cache stats:', error);
            throw error;
        }
    }

    /**
     * Clear all cache entries
     * 
     * Truncates the ai_response_cache table, removing all entries.
     * This is a destructive operation and should be used with caution.
     */
    async clearAllCache(): Promise<void> {
        try {
            // Delete all cache entries
            const { error } = await supabase
                .from('ai_response_cache')
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows

            if (error) {
                throw error;
            }

            console.log('🗑️ ALL CACHE CLEARED', {
                message: 'All cache entries have been deleted'
            });
        } catch (error) {
            console.error('Error clearing all cache:', error);
            throw error;
        }
    }

    /**
     * Track cache statistics
     * 
     * Updates the ai_cache_stats table with daily aggregated statistics.
     * Increments total_requests, cache_hits or cache_misses, and tokens_saved.
     * 
     * @param isHit - Whether this was a cache hit (true) or miss (false)
     * @param tokensSaved - Number of tokens saved (only for cache hits)
     * @private
     */
    private async trackCacheStats(isHit: boolean, tokensSaved: number): Promise<void> {
        try {
            const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format

            // Call the database function to increment stats
            const { error } = await supabase.rpc('increment_cache_stats', {
                p_date: today,
                p_is_hit: isHit,
                p_tokens_saved: tokensSaved
            });

            if (error) {
                // Log error but don't fail the request
                console.error('Error tracking cache stats:', error);
            }
        } catch (error) {
            // Log error but don't fail the request
            console.error('Error tracking cache stats:', error);
        }
    }
}

// Export singleton instance
export const aiCacheService = new AICacheService();
