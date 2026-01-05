import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { AICacheService, CacheKey, OperationType } from '../services/aiCache';

// Arbitrary for generating valid operation types
const operationTypeArb = fc.constantFrom<OperationType>(
    'test_generation',
    'chat',
    'summary',
    'flashcards',
    'mindmap'
);

// Arbitrary for generating 64-character hex strings (SHA-256 hashes)
const hexHashArb = fc.array(
    fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'),
    { minLength: 64, maxLength: 64 }
).map(arr => arr.join(''));

// Arbitrary for generating cache keys
const cacheKeyArb = fc.record({
    operationType: operationTypeArb,
    lectureIds: fc.array(fc.uuid(), { minLength: 1, maxLength: 5 }),
    params: fc.dictionary(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(
            fc.string(),
            fc.integer(),
            fc.boolean(),
            fc.constant(null)
        )
    ),
    contentHash: hexHashArb
});

describe('AICacheService', () => {
    const service = new AICacheService();

    /**
     * Feature: ai-response-caching, Property 4: Different parameters generate different keys
     * Validates: Requirements 1.4, 5.1-5.5
     * 
     * For any two requests with different parameters (operation type, lecture IDs, 
     * params, or content hash), the system should generate different cache keys
     */
    describe('Property 4: Cache key uniqueness', () => {

        it('should generate identical keys for identical parameters', () => {
            fc.assert(
                fc.property(cacheKeyArb, (key) => {
                    const key1 = service.generateCacheKey(key);
                    const key2 = service.generateCacheKey(key);
                    const key3 = service.generateCacheKey(key);

                    // All keys should be identical
                    expect(key1).toBe(key2);
                    expect(key2).toBe(key3);
                }),
                { numRuns: 100 }
            );
        });

        it('should generate identical keys regardless of lecture ID order', () => {
            fc.assert(
                fc.property(
                    operationTypeArb,
                    fc.array(fc.uuid(), { minLength: 2, maxLength: 5 }),
                    fc.dictionary(fc.string(), fc.string()),
                    hexHashArb,
                    (operationType, lectureIds, params, contentHash) => {
                        // Create two keys with same lecture IDs in different order
                        const key1: CacheKey = {
                            operationType,
                            lectureIds: [...lectureIds],
                            params,
                            contentHash
                        };

                        const key2: CacheKey = {
                            operationType,
                            lectureIds: [...lectureIds].reverse(),
                            params,
                            contentHash
                        };

                        const hash1 = service.generateCacheKey(key1);
                        const hash2 = service.generateCacheKey(key2);

                        // Should generate same key regardless of order
                        expect(hash1).toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate identical keys regardless of param key order', () => {
            fc.assert(
                fc.property(
                    operationTypeArb,
                    fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
                    hexHashArb,
                    (operationType, lectureIds, contentHash) => {
                        // Create params with multiple keys
                        const params1 = { a: 1, b: 2, c: 3 };
                        const params2 = { c: 3, a: 1, b: 2 }; // Different order

                        const key1: CacheKey = {
                            operationType,
                            lectureIds,
                            params: params1,
                            contentHash
                        };

                        const key2: CacheKey = {
                            operationType,
                            lectureIds,
                            params: params2,
                            contentHash
                        };

                        const hash1 = service.generateCacheKey(key1);
                        const hash2 = service.generateCacheKey(key2);

                        // Should generate same key regardless of param order
                        expect(hash1).toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate different keys when operation type differs', () => {
            fc.assert(
                fc.property(
                    fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
                    fc.dictionary(fc.string(), fc.string()),
                    hexHashArb,
                    (lectureIds, params, contentHash) => {
                        const key1: CacheKey = {
                            operationType: 'test_generation',
                            lectureIds,
                            params,
                            contentHash
                        };

                        const key2: CacheKey = {
                            operationType: 'chat',
                            lectureIds,
                            params,
                            contentHash
                        };

                        const hash1 = service.generateCacheKey(key1);
                        const hash2 = service.generateCacheKey(key2);

                        // Different operation types should produce different keys
                        expect(hash1).not.toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate different keys when lecture IDs differ', () => {
            fc.assert(
                fc.property(
                    operationTypeArb,
                    fc.uuid(),
                    fc.uuid(),
                    fc.dictionary(fc.string(), fc.string()),
                    hexHashArb,
                    (operationType, lectureId1, lectureId2, params, contentHash) => {
                        // Skip if UUIDs are the same
                        if (lectureId1 === lectureId2) {
                            return true;
                        }

                        const key1: CacheKey = {
                            operationType,
                            lectureIds: [lectureId1],
                            params,
                            contentHash
                        };

                        const key2: CacheKey = {
                            operationType,
                            lectureIds: [lectureId2],
                            params,
                            contentHash
                        };

                        const hash1 = service.generateCacheKey(key1);
                        const hash2 = service.generateCacheKey(key2);

                        // Different lecture IDs should produce different keys
                        expect(hash1).not.toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate different keys when params differ', () => {
            fc.assert(
                fc.property(
                    operationTypeArb,
                    fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
                    hexHashArb,
                    (operationType, lectureIds, contentHash) => {
                        const key1: CacheKey = {
                            operationType,
                            lectureIds,
                            params: { questionsCount: 10 },
                            contentHash
                        };

                        const key2: CacheKey = {
                            operationType,
                            lectureIds,
                            params: { questionsCount: 20 },
                            contentHash
                        };

                        const hash1 = service.generateCacheKey(key1);
                        const hash2 = service.generateCacheKey(key2);

                        // Different params should produce different keys
                        expect(hash1).not.toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate different keys when content hash differs', () => {
            fc.assert(
                fc.property(
                    operationTypeArb,
                    fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }),
                    fc.dictionary(fc.string(), fc.string()),
                    hexHashArb,
                    hexHashArb,
                    (operationType, lectureIds, params, contentHash1, contentHash2) => {
                        // Skip if hashes are the same
                        if (contentHash1 === contentHash2) {
                            return true;
                        }

                        const key1: CacheKey = {
                            operationType,
                            lectureIds,
                            params,
                            contentHash: contentHash1
                        };

                        const key2: CacheKey = {
                            operationType,
                            lectureIds,
                            params,
                            contentHash: contentHash2
                        };

                        const hash1 = service.generateCacheKey(key1);
                        const hash2 = service.generateCacheKey(key2);

                        // Different content hashes should produce different keys
                        expect(hash1).not.toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate 64-character hex string keys', () => {
            fc.assert(
                fc.property(cacheKeyArb, (key) => {
                    const cacheKey = service.generateCacheKey(key);

                    // SHA-256 produces 64 hex characters
                    expect(cacheKey).toHaveLength(64);
                    expect(cacheKey).toMatch(/^[a-f0-9]{64}$/);
                }),
                { numRuns: 100 }
            );
        });

        it('should throw error for invalid input', () => {
            // Missing operation type
            expect(() => {
                service.generateCacheKey({
                    operationType: '' as OperationType,
                    lectureIds: ['uuid'],
                    params: {},
                    contentHash: 'hash'
                });
            }).toThrow('operationType is required');

            // Empty lecture IDs
            expect(() => {
                service.generateCacheKey({
                    operationType: 'test_generation',
                    lectureIds: [],
                    params: {},
                    contentHash: 'hash'
                });
            }).toThrow('lectureIds must be a non-empty array');

            // Missing content hash
            expect(() => {
                service.generateCacheKey({
                    operationType: 'test_generation',
                    lectureIds: ['uuid'],
                    params: {},
                    contentHash: ''
                });
            }).toThrow('contentHash is required');
        });
    });

    /**
     * Feature: ai-response-caching, Property 2: Cache hit returns without API call
     * Validates: Requirements 1.2
     * 
     * For any request where a cached response exists with matching cache key, 
     * the system should return the cached response without calling Gemini API
     */
    describe('Property 2: Cache hit behavior', () => {
        const testCacheKeys: string[] = [];

        afterEach(async () => {
            // Clean up test data
            if (testCacheKeys.length > 0) {
                const { supabase } = await import('../config/supabase');
                await supabase
                    .from('ai_response_cache')
                    .delete()
                    .in('cache_key', testCacheKeys);
                testCacheKeys.length = 0;
            }
        });

        it('should return cached response when cache key exists', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    async (keyInput, responseData, tokensUsed, contentSize) => {
                        const { supabase } = await import('../config/supabase');

                        // Generate cache key
                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        // Insert test cache entry
                        const { error: insertError } = await supabase
                            .from('ai_response_cache')
                            .insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: responseData,
                                tokens_used: tokensUsed,
                                content_size: contentSize,
                                hit_count: 0
                            });

                        if (insertError) {
                            console.error('Insert error:', insertError);
                            throw insertError;
                        }

                        // Get cached response
                        const cached = await service.getCachedResponse(cacheKey);

                        // Should return the cached data
                        expect(cached).not.toBeNull();
                        expect(cached?.cache_key).toBe(cacheKey);
                        expect(cached?.operation_type).toBe(keyInput.operationType);
                        expect(cached?.response_data).toEqual(responseData);
                        expect(cached?.tokens_used).toBe(tokensUsed);
                        expect(cached?.content_size).toBe(contentSize);
                    }
                ),
                { numRuns: 20 } // Reduced for database operations
            );
        });

        it('should return null when cache key does not exist', async () => {
            await fc.assert(
                fc.asyncProperty(
                    hexHashArb,
                    async (cacheKey) => {
                        // Try to get non-existent cache entry
                        const cached = await service.getCachedResponse(cacheKey);

                        // Should return null
                        expect(cached).toBeNull();
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('should increment hit_count on each cache hit', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    async (keyInput, responseData, tokensUsed, contentSize) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        // Insert test cache entry
                        await supabase
                            .from('ai_response_cache')
                            .insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: responseData,
                                tokens_used: tokensUsed,
                                content_size: contentSize,
                                hit_count: 0
                            });

                        // Get cached response multiple times
                        await service.getCachedResponse(cacheKey);
                        await service.getCachedResponse(cacheKey);
                        const cached = await service.getCachedResponse(cacheKey);

                        // Hit count should be 3
                        expect(cached?.hit_count).toBe(3);
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('should update last_accessed_at on cache hit', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    async (keyInput, responseData, tokensUsed, contentSize) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        const initialTime = new Date('2024-01-01T00:00:00Z').toISOString();

                        // Insert test cache entry with old timestamp
                        await supabase
                            .from('ai_response_cache')
                            .insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: responseData,
                                tokens_used: tokensUsed,
                                content_size: contentSize,
                                hit_count: 0,
                                last_accessed_at: initialTime
                            });

                        // Get cached response
                        const cached = await service.getCachedResponse(cacheKey);

                        // last_accessed_at should be updated (not the initial time)
                        expect(cached?.last_accessed_at).not.toBe(initialTime);

                        // Should be a recent timestamp
                        const accessedTime = new Date(cached!.last_accessed_at);
                        const now = new Date();
                        const diffMs = now.getTime() - accessedTime.getTime();

                        // Should be within last 5 seconds
                        expect(diffMs).toBeLessThan(5000);
                    }
                ),
                { numRuns: 20 }
            );
        });
    });

    /**
     * Feature: ai-response-caching, Property 6: Lecture deletion cascades to cache
     * Validates: Requirements 3.5
     * 
     * For any lecture, when it is deleted, all cached responses containing 
     * that lecture_id should be automatically deleted
     */
    describe('Property 6: Lecture cache invalidation', () => {
        const testCacheKeys: string[] = [];

        afterEach(async () => {
            // Clean up test data
            if (testCacheKeys.length > 0) {
                const { supabase } = await import('../config/supabase');
                await supabase
                    .from('ai_response_cache')
                    .delete()
                    .in('cache_key', testCacheKeys);
                testCacheKeys.length = 0;
            }
        });

        it('should delete all cache entries containing the lecture_id', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(), // Target lecture ID to invalidate
                    fc.array(fc.uuid(), { minLength: 1, maxLength: 3 }), // Other lecture IDs
                    fc.integer({ min: 1, max: 5 }), // Number of cache entries with target lecture
                    fc.integer({ min: 1, max: 3 }), // Number of cache entries without target lecture
                    async (targetLectureId, otherLectureIds, withTargetCount, withoutTargetCount) => {
                        const { supabase } = await import('../config/supabase');

                        // Create cache entries that contain the target lecture ID
                        const entriesWithTarget = [];
                        for (let i = 0; i < withTargetCount; i++) {
                            const keyInput: CacheKey = {
                                operationType: 'test_generation',
                                lectureIds: [targetLectureId, ...otherLectureIds.slice(0, i % otherLectureIds.length)],
                                params: { index: i },
                                contentHash: 'a'.repeat(64)
                            };
                            const cacheKey = service.generateCacheKey(keyInput);
                            testCacheKeys.push(cacheKey);

                            await supabase.from('ai_response_cache').insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: { test: `data-${i}` },
                                tokens_used: 100,
                                content_size: 1000,
                                hit_count: 0
                            });

                            entriesWithTarget.push(cacheKey);
                        }

                        // Create cache entries that do NOT contain the target lecture ID
                        const entriesWithoutTarget = [];
                        for (let i = 0; i < withoutTargetCount; i++) {
                            const keyInput: CacheKey = {
                                operationType: 'chat',
                                lectureIds: otherLectureIds.filter(id => id !== targetLectureId),
                                params: { index: i + 100 },
                                contentHash: 'b'.repeat(64)
                            };
                            const cacheKey = service.generateCacheKey(keyInput);
                            testCacheKeys.push(cacheKey);

                            await supabase.from('ai_response_cache').insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: { test: `data-${i + 100}` },
                                tokens_used: 200,
                                content_size: 2000,
                                hit_count: 0
                            });

                            entriesWithoutTarget.push(cacheKey);
                        }

                        // Invalidate cache for target lecture
                        const deletedCount = await service.invalidateLectureCache(targetLectureId);

                        // Should delete exactly the entries with target lecture
                        expect(deletedCount).toBe(withTargetCount);

                        // Verify entries with target lecture are deleted
                        for (const cacheKey of entriesWithTarget) {
                            const { data } = await supabase
                                .from('ai_response_cache')
                                .select('*')
                                .eq('cache_key', cacheKey)
                                .single();
                            expect(data).toBeNull();
                        }

                        // Verify entries without target lecture still exist
                        for (const cacheKey of entriesWithoutTarget) {
                            const { data } = await supabase
                                .from('ai_response_cache')
                                .select('*')
                                .eq('cache_key', cacheKey)
                                .single();
                            expect(data).not.toBeNull();
                        }
                    }
                ),
                { numRuns: 10 } // Reduced for database operations
            );
        });

        it('should return 0 when no cache entries contain the lecture_id', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    async (lectureId) => {
                        // Invalidate cache for non-existent lecture
                        const deletedCount = await service.invalidateLectureCache(lectureId);

                        // Should return 0
                        expect(deletedCount).toBe(0);
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('should handle lecture_id in any position of the array', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.uuid(),
                    fc.array(fc.uuid(), { minLength: 2, maxLength: 4 }),
                    fc.integer({ min: 0, max: 3 }),
                    async (targetLectureId, otherLectureIds, position) => {
                        const { supabase } = await import('../config/supabase');

                        // Insert target lecture at different positions
                        const lectureIds = [...otherLectureIds];
                        lectureIds.splice(position % lectureIds.length, 0, targetLectureId);

                        const keyInput: CacheKey = {
                            operationType: 'summary',
                            lectureIds,
                            params: {},
                            contentHash: 'c'.repeat(64)
                        };
                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        await supabase.from('ai_response_cache').insert({
                            cache_key: cacheKey,
                            operation_type: keyInput.operationType,
                            lecture_ids: keyInput.lectureIds,
                            params: keyInput.params,
                            content_hash: keyInput.contentHash,
                            response_data: { test: 'data' },
                            tokens_used: 100,
                            content_size: 1000,
                            hit_count: 0
                        });

                        // Invalidate cache
                        const deletedCount = await service.invalidateLectureCache(targetLectureId);

                        // Should find and delete the entry regardless of position
                        expect(deletedCount).toBeGreaterThanOrEqual(1);

                        // Verify entry is deleted
                        const { data } = await supabase
                            .from('ai_response_cache')
                            .select('*')
                            .eq('cache_key', cacheKey)
                            .single();
                        expect(data).toBeNull();
                    }
                ),
                { numRuns: 20 }
            );
        });
    });

    /**
     * Feature: ai-response-caching, Property 7: Old cache cleanup removes entries
     * Validates: Requirements 3.3
     * 
     * For any specified age threshold, the cleanup operation should remove all 
     * cache entries older than that threshold and keep newer ones
     */
    describe('Property 7: Old cache cleanup', () => {
        const testCacheKeys: string[] = [];

        afterEach(async () => {
            // Clean up test data
            if (testCacheKeys.length > 0) {
                const { supabase } = await import('../config/supabase');
                await supabase
                    .from('ai_response_cache')
                    .delete()
                    .in('cache_key', testCacheKeys);
                testCacheKeys.length = 0;
            }
        });

        it('should delete entries older than threshold and keep newer ones', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 30 }), // Days threshold
                    fc.integer({ min: 1, max: 3 }), // Number of old entries
                    fc.integer({ min: 1, max: 3 }), // Number of new entries
                    async (daysThreshold, oldEntriesCount, newEntriesCount) => {
                        const { supabase } = await import('../config/supabase');

                        // Create old entries (older than threshold)
                        const oldDate = new Date();
                        oldDate.setDate(oldDate.getDate() - daysThreshold - 1);

                        const oldEntries = [];
                        for (let i = 0; i < oldEntriesCount; i++) {
                            const keyInput: CacheKey = {
                                operationType: 'test_generation',
                                lectureIds: [fc.sample(fc.uuid(), 1)[0]],
                                params: { old: true, index: i },
                                contentHash: 'a'.repeat(64)
                            };
                            const cacheKey = service.generateCacheKey(keyInput);
                            testCacheKeys.push(cacheKey);

                            await supabase.from('ai_response_cache').insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: { test: `old-data-${i}` },
                                tokens_used: 100,
                                content_size: 1000,
                                hit_count: 0,
                                created_at: oldDate.toISOString()
                            });

                            oldEntries.push(cacheKey);
                        }

                        // Create new entries (newer than threshold)
                        const newDate = new Date();
                        newDate.setDate(newDate.getDate() - Math.floor(daysThreshold / 2));

                        const newEntries = [];
                        for (let i = 0; i < newEntriesCount; i++) {
                            const keyInput: CacheKey = {
                                operationType: 'chat',
                                lectureIds: [fc.sample(fc.uuid(), 1)[0]],
                                params: { old: false, index: i },
                                contentHash: 'b'.repeat(64)
                            };
                            const cacheKey = service.generateCacheKey(keyInput);
                            testCacheKeys.push(cacheKey);

                            await supabase.from('ai_response_cache').insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: { test: `new-data-${i}` },
                                tokens_used: 200,
                                content_size: 2000,
                                hit_count: 0,
                                created_at: newDate.toISOString()
                            });

                            newEntries.push(cacheKey);
                        }

                        // Clear old cache
                        const deletedCount = await service.clearOldCache(daysThreshold);

                        // Should delete exactly the old entries
                        expect(deletedCount).toBe(oldEntriesCount);

                        // Verify old entries are deleted
                        for (const cacheKey of oldEntries) {
                            const { data } = await supabase
                                .from('ai_response_cache')
                                .select('*')
                                .eq('cache_key', cacheKey)
                                .single();
                            expect(data).toBeNull();
                        }

                        // Verify new entries still exist
                        for (const cacheKey of newEntries) {
                            const { data } = await supabase
                                .from('ai_response_cache')
                                .select('*')
                                .eq('cache_key', cacheKey)
                                .single();
                            expect(data).not.toBeNull();
                        }
                    }
                ),
                { numRuns: 10 } // Reduced for database operations
            );
        });

        it('should return 0 when no entries are older than threshold', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 30 }),
                    async (daysThreshold) => {
                        const { supabase } = await import('../config/supabase');

                        // Create a recent entry
                        const keyInput: CacheKey = {
                            operationType: 'summary',
                            lectureIds: [fc.sample(fc.uuid(), 1)[0]],
                            params: {},
                            contentHash: 'c'.repeat(64)
                        };
                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        await supabase.from('ai_response_cache').insert({
                            cache_key: cacheKey,
                            operation_type: keyInput.operationType,
                            lecture_ids: keyInput.lectureIds,
                            params: keyInput.params,
                            content_hash: keyInput.contentHash,
                            response_data: { test: 'recent-data' },
                            tokens_used: 100,
                            content_size: 1000,
                            hit_count: 0,
                            created_at: new Date().toISOString()
                        });

                        // Clear old cache
                        const deletedCount = await service.clearOldCache(daysThreshold);

                        // Should return 0
                        expect(deletedCount).toBe(0);

                        // Verify entry still exists
                        const { data } = await supabase
                            .from('ai_response_cache')
                            .select('*')
                            .eq('cache_key', cacheKey)
                            .single();
                        expect(data).not.toBeNull();
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('should handle edge case at exact threshold boundary', async () => {
            await fc.assert(
                fc.asyncProperty(
                    fc.integer({ min: 1, max: 30 }),
                    async (daysThreshold) => {
                        const { supabase } = await import('../config/supabase');

                        // Create entry exactly at threshold
                        const exactDate = new Date();
                        exactDate.setDate(exactDate.getDate() - daysThreshold);

                        const keyInput: CacheKey = {
                            operationType: 'flashcards',
                            lectureIds: [fc.sample(fc.uuid(), 1)[0]],
                            params: {},
                            contentHash: 'd'.repeat(64)
                        };
                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        await supabase.from('ai_response_cache').insert({
                            cache_key: cacheKey,
                            operation_type: keyInput.operationType,
                            lecture_ids: keyInput.lectureIds,
                            params: keyInput.params,
                            content_hash: keyInput.contentHash,
                            response_data: { test: 'boundary-data' },
                            tokens_used: 100,
                            content_size: 1000,
                            hit_count: 0,
                            created_at: exactDate.toISOString()
                        });

                        // Clear old cache
                        await service.clearOldCache(daysThreshold);

                        // Entry at exact boundary should still exist (not older than threshold)
                        const { data } = await supabase
                            .from('ai_response_cache')
                            .select('*')
                            .eq('cache_key', cacheKey)
                            .single();
                        expect(data).not.toBeNull();
                    }
                ),
                { numRuns: 20 }
            );
        });
    });

    /**
     * Feature: ai-response-caching, Property 3: Cache miss stores response
     * Validates: Requirements 1.3, 2.1
     * 
     * For any request where no cached response exists, after calling Gemini API 
     * the system should store the response in cache with all required fields
     */
    describe('Property 3: Cache storage', () => {
        const testCacheKeys: string[] = [];

        afterEach(async () => {
            // Clean up test data
            if (testCacheKeys.length > 0) {
                const { supabase } = await import('../config/supabase');
                await supabase
                    .from('ai_response_cache')
                    .delete()
                    .in('cache_key', testCacheKeys);
                testCacheKeys.length = 0;
            }
        });

        it('should store response with all required fields', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    async (keyInput, responseData, tokensUsed, contentSize) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        // Store response
                        await service.cacheResponse(
                            cacheKey,
                            keyInput.operationType,
                            keyInput.lectureIds,
                            keyInput.params,
                            keyInput.contentHash,
                            responseData,
                            tokensUsed,
                            contentSize
                        );

                        // Verify it was stored
                        const { data, error } = await supabase
                            .from('ai_response_cache')
                            .select('*')
                            .eq('cache_key', cacheKey)
                            .single();

                        expect(error).toBeNull();
                        expect(data).not.toBeNull();
                        expect(data?.cache_key).toBe(cacheKey);
                        expect(data?.operation_type).toBe(keyInput.operationType);
                        expect(data?.lecture_ids).toEqual(keyInput.lectureIds);
                        expect(data?.params).toEqual(keyInput.params);
                        expect(data?.content_hash).toBe(keyInput.contentHash);
                        expect(data?.response_data).toEqual(responseData);
                        expect(data?.tokens_used).toBe(tokensUsed);
                        expect(data?.content_size).toBe(contentSize);
                        expect(data?.hit_count).toBe(0);
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('should handle upsert on duplicate cache key', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    async (keyInput, responseData1, responseData2, tokensUsed, contentSize) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        // Store first response
                        await service.cacheResponse(
                            cacheKey,
                            keyInput.operationType,
                            keyInput.lectureIds,
                            keyInput.params,
                            keyInput.contentHash,
                            responseData1,
                            tokensUsed,
                            contentSize
                        );

                        // Store second response with same key (should upsert)
                        await service.cacheResponse(
                            cacheKey,
                            keyInput.operationType,
                            keyInput.lectureIds,
                            keyInput.params,
                            keyInput.contentHash,
                            responseData2,
                            tokensUsed + 100,
                            contentSize + 100
                        );

                        // Verify only one entry exists with updated data
                        const { data, error } = await supabase
                            .from('ai_response_cache')
                            .select('*')
                            .eq('cache_key', cacheKey);

                        expect(error).toBeNull();
                        expect(data).toHaveLength(1);
                        expect(data?.[0]?.response_data).toEqual(responseData2);
                        expect(data?.[0]?.tokens_used).toBe(tokensUsed + 100);
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('should store response_data as JSONB', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.record({
                        questions: fc.array(fc.record({
                            text: fc.string(),
                            options: fc.array(fc.string(), { minLength: 2, maxLength: 4 }),
                            correctAnswer: fc.integer({ min: 0, max: 3 })
                        }), { minLength: 1, maxLength: 5 })
                    }),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    async (keyInput, complexData, tokensUsed, contentSize) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        // Store complex nested data
                        await service.cacheResponse(
                            cacheKey,
                            keyInput.operationType,
                            keyInput.lectureIds,
                            keyInput.params,
                            keyInput.contentHash,
                            complexData,
                            tokensUsed,
                            contentSize
                        );

                        // Verify complex data is preserved
                        const { data, error } = await supabase
                            .from('ai_response_cache')
                            .select('response_data')
                            .eq('cache_key', cacheKey)
                            .single();

                        expect(error).toBeNull();
                        expect(data?.response_data).toEqual(complexData);
                    }
                ),
                { numRuns: 20 }
            );
        });

        it('should not throw error on cache failure', async () => {
            // Test that caching errors don't break the flow
            const invalidCacheKey = service.generateCacheKey({
                operationType: 'test_generation',
                lectureIds: ['test-id'],
                params: {},
                contentHash: 'a'.repeat(64)
            });

            // This should not throw even if there's a database error
            await expect(
                service.cacheResponse(
                    invalidCacheKey,
                    'test_generation',
                    ['test-id'],
                    {},
                    'a'.repeat(64),
                    { test: 'data' },
                    100,
                    1000
                )
            ).resolves.not.toThrow();
        });
    });

    /**
     * Feature: ai-response-caching, Property 10: Hit counter increments
     * Validates: Requirements 8.1-8.2
     * 
     * For any cached response that is returned, the hit_count field should be 
     * incremented by 1
     */
    describe('Property 10: Hit counter increments', () => {
        const testCacheKeys: string[] = [];

        afterEach(async () => {
            // Clean up test data
            if (testCacheKeys.length > 0) {
                const { supabase } = await import('../config/supabase');
                await supabase
                    .from('ai_response_cache')
                    .delete()
                    .in('cache_key', testCacheKeys);
                testCacheKeys.length = 0;
            }
        });

        it('should increment hit_count by 1 for each cache access', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    fc.integer({ min: 1, max: 10 }), // Number of times to access cache
                    async (keyInput, responseData, tokensUsed, contentSize, accessCount) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        // Insert test cache entry with initial hit_count of 0
                        await supabase
                            .from('ai_response_cache')
                            .insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: responseData,
                                tokens_used: tokensUsed,
                                content_size: contentSize,
                                hit_count: 0
                            });

                        // Access cache multiple times
                        for (let i = 0; i < accessCount; i++) {
                            await service.getCachedResponse(cacheKey);
                        }

                        // Get final cached response
                        const cached = await service.getCachedResponse(cacheKey);

                        // Hit count should be accessCount + 1 (for the final get)
                        expect(cached?.hit_count).toBe(accessCount + 1);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should increment hit_count from any initial value', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    fc.integer({ min: 0, max: 100 }), // Initial hit count
                    fc.integer({ min: 1, max: 5 }), // Additional accesses
                    async (keyInput, responseData, tokensUsed, contentSize, initialHitCount, additionalAccesses) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey = service.generateCacheKey(keyInput);
                        testCacheKeys.push(cacheKey);

                        // Insert test cache entry with initial hit_count
                        await supabase
                            .from('ai_response_cache')
                            .insert({
                                cache_key: cacheKey,
                                operation_type: keyInput.operationType,
                                lecture_ids: keyInput.lectureIds,
                                params: keyInput.params,
                                content_hash: keyInput.contentHash,
                                response_data: responseData,
                                tokens_used: tokensUsed,
                                content_size: contentSize,
                                hit_count: initialHitCount
                            });

                        // Access cache additional times
                        for (let i = 0; i < additionalAccesses; i++) {
                            await service.getCachedResponse(cacheKey);
                        }

                        // Get final cached response
                        const cached = await service.getCachedResponse(cacheKey);

                        // Hit count should be initial + additional + 1 (for final get)
                        expect(cached?.hit_count).toBe(initialHitCount + additionalAccesses + 1);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should not increment hit_count on cache miss', async () => {
            await fc.assert(
                fc.asyncProperty(
                    hexHashArb,
                    async (nonExistentCacheKey) => {
                        // Try to get non-existent cache entry
                        const cached = await service.getCachedResponse(nonExistentCacheKey);

                        // Should return null (no hit count to increment)
                        expect(cached).toBeNull();
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should increment hit_count independently for different cache entries', async () => {
            await fc.assert(
                fc.asyncProperty(
                    cacheKeyArb,
                    cacheKeyArb,
                    fc.jsonValue(),
                    fc.integer({ min: 100, max: 10000 }),
                    fc.integer({ min: 1000, max: 100000 }),
                    fc.integer({ min: 1, max: 5 }),
                    fc.integer({ min: 1, max: 5 }),
                    async (keyInput1, keyInput2, responseData, tokensUsed, contentSize, accesses1, accesses2) => {
                        const { supabase } = await import('../config/supabase');

                        const cacheKey1 = service.generateCacheKey(keyInput1);
                        const cacheKey2 = service.generateCacheKey(keyInput2);

                        // Skip if keys are the same
                        if (cacheKey1 === cacheKey2) {
                            return true;
                        }

                        testCacheKeys.push(cacheKey1, cacheKey2);

                        // Insert two different cache entries
                        await supabase.from('ai_response_cache').insert([
                            {
                                cache_key: cacheKey1,
                                operation_type: keyInput1.operationType,
                                lecture_ids: keyInput1.lectureIds,
                                params: keyInput1.params,
                                content_hash: keyInput1.contentHash,
                                response_data: responseData,
                                tokens_used: tokensUsed,
                                content_size: contentSize,
                                hit_count: 0
                            },
                            {
                                cache_key: cacheKey2,
                                operation_type: keyInput2.operationType,
                                lecture_ids: keyInput2.lectureIds,
                                params: keyInput2.params,
                                content_hash: keyInput2.contentHash,
                                response_data: responseData,
                                tokens_used: tokensUsed,
                                content_size: contentSize,
                                hit_count: 0
                            }
                        ]);

                        // Access first cache entry
                        for (let i = 0; i < accesses1; i++) {
                            await service.getCachedResponse(cacheKey1);
                        }

                        // Access second cache entry
                        for (let i = 0; i < accesses2; i++) {
                            await service.getCachedResponse(cacheKey2);
                        }

                        // Get both cached responses
                        const cached1 = await service.getCachedResponse(cacheKey1);
                        const cached2 = await service.getCachedResponse(cacheKey2);

                        // Each should have its own independent hit count
                        expect(cached1?.hit_count).toBe(accesses1 + 1);
                        expect(cached2?.hit_count).toBe(accesses2 + 1);
                    }
                ),
                { numRuns: 50 }
            );
        });
    });
});
