import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { aiCacheService } from '../services/aiCache';
import { contentHashService } from '../services/contentHash';

/**
 * Load Tests for AI Response Caching System
 * 
 * These tests verify cache performance under load, measure response time improvements,
 * verify no race conditions occur, and test with large responses.
 * 
 * Note: These tests use mocked Supabase to avoid database dependencies
 * while still testing the performance characteristics of the caching system.
 */

// Mock data storage for load testing
const mockData = new Map();
const mockLectureHashes = new Map();
let mockOperationDelay = 0; // Simulate database latency

// Mock Supabase with performance simulation
vi.mock('../config/supabase', () => {
    return {
        supabase: {
            from: (table: string) => {
                if (table === 'ai_response_cache') {
                    return {
                        select: (columns?: string) => ({
                            eq: (column: string, value: any) => ({
                                single: async () => {
                                    // Simulate database latency
                                    if (mockOperationDelay > 0) {
                                        await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                                    }

                                    const key = `${column}:${value}`;
                                    const data = mockData.get(key);
                                    return Promise.resolve({
                                        data: data || null,
                                        error: null
                                    });
                                }
                            })
                        }),
                        insert: async (data: any) => {
                            // Simulate database latency
                            if (mockOperationDelay > 0) {
                                await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                            }

                            const key = `cache_key:${data.cache_key}`;
                            mockData.set(key, {
                                ...data,
                                id: Math.random().toString(),
                                hit_count: data.hit_count || 0,
                                created_at: data.created_at || new Date().toISOString(),
                                last_accessed_at: data.last_accessed_at || new Date().toISOString()
                            });
                            return Promise.resolve({ data: null, error: null });
                        },
                        upsert: async (data: any) => {
                            // Simulate database latency
                            if (mockOperationDelay > 0) {
                                await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                            }

                            const key = `cache_key:${data.cache_key}`;
                            const existing = mockData.get(key);
                            mockData.set(key, {
                                ...existing,
                                ...data,
                                id: existing?.id || Math.random().toString(),
                                created_at: existing?.created_at || new Date().toISOString(),
                                last_accessed_at: new Date().toISOString()
                            });
                            return Promise.resolve({ data: null, error: null });
                        },
                        update: (data: any) => ({
                            eq: async (column: string, value: any) => {
                                // Simulate database latency
                                if (mockOperationDelay > 0) {
                                    await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                                }

                                const key = `${column}:${value}`;
                                const existing = mockData.get(key);
                                if (existing) {
                                    mockData.set(key, {
                                        ...existing,
                                        ...data,
                                        last_accessed_at: new Date().toISOString()
                                    });
                                }
                                return Promise.resolve({ data: null, error: null });
                            }
                        }),
                        delete: () => ({
                            contains: (column: string, values: any[]) => ({
                                select: async () => {
                                    // Simulate database latency
                                    if (mockOperationDelay > 0) {
                                        await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                                    }

                                    let deletedCount = 0;
                                    const toDelete = [];
                                    for (const [key, data] of mockData.entries()) {
                                        if (key.startsWith('cache_key:') && data[column]) {
                                            const hasMatch = values.some(val =>
                                                Array.isArray(data[column]) && data[column].includes(val)
                                            );
                                            if (hasMatch) {
                                                toDelete.push(key);
                                                deletedCount++;
                                            }
                                        }
                                    }
                                    toDelete.forEach(key => mockData.delete(key));
                                    return Promise.resolve({
                                        data: Array(deletedCount).fill({}),
                                        error: null
                                    });
                                }
                            })
                        })
                    };
                } else if (table === 'lecture_content_hashes') {
                    return {
                        select: (columns?: string) => ({
                            eq: (column: string, value: any) => ({
                                single: async () => {
                                    // Simulate database latency
                                    if (mockOperationDelay > 0) {
                                        await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                                    }

                                    const data = mockLectureHashes.get(value);
                                    return Promise.resolve({
                                        data: data ? { lecture_id: value, content_hash: data } : null,
                                        error: null
                                    });
                                }
                            })
                        }),
                        upsert: async (data: any) => {
                            // Simulate database latency
                            if (mockOperationDelay > 0) {
                                await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                            }

                            mockLectureHashes.set(data.lecture_id, data.content_hash);
                            return Promise.resolve({ data: null, error: null });
                        }
                    };
                }
                return {};
            },
            rpc: async (functionName: string, params?: any) => {
                // Simulate database latency
                if (mockOperationDelay > 0) {
                    await new Promise(resolve => setTimeout(resolve, mockOperationDelay));
                }

                if (functionName === 'get_cache_stats') {
                    const totalEntries = mockData.size;
                    let totalHits = 0;
                    let tokensSaved = 0;

                    for (const data of mockData.values()) {
                        if (data.hit_count > 0) {
                            totalHits += data.hit_count;
                            tokensSaved += data.tokens_used * (data.hit_count - 1);
                        }
                    }

                    return Promise.resolve({
                        data: {
                            total_entries: totalEntries,
                            total_hits: totalHits,
                            total_misses: 5,
                            hit_rate: totalHits > 0 ? (totalHits / (totalHits + 5)) * 100 : 0,
                            tokens_saved: tokensSaved,
                            estimated_cost_saved: tokensSaved * 0.000075,
                            storage_used: 1024,
                            oldest_entry: '2024-01-01T00:00:00Z',
                            newest_entry: new Date().toISOString()
                        },
                        error: null
                    });
                }
                return Promise.resolve({ data: null, error: null });
            }
        }
    };
});

describe('AI Cache Load Tests', () => {
    beforeEach(() => {
        // Clear mock data before each test
        mockData.clear();
        mockLectureHashes.clear();
        mockOperationDelay = 0;
    });

    afterEach(() => {
        // Reset delay after each test
        mockOperationDelay = 0;
    });

    describe('Cache Performance Under Load', () => {
        it('should handle concurrent cache operations efficiently', async () => {
            const concurrentRequests = 50;
            const lectureIds = ['550e8400-e29b-41d4-a716-446655440001'];
            const content = 'Load test content for concurrent operations';
            const contentHash = contentHashService.generateHash(content);

            // Create promises for concurrent cache operations
            const cachePromises = Array.from({ length: concurrentRequests }, async (_, i) => {
                const cacheKey = aiCacheService.generateCacheKey({
                    operationType: 'test_generation',
                    lectureIds,
                    params: { questionsCount: 10, requestId: i },
                    contentHash
                });

                const mockResponse = {
                    questions: [`Question ${i}1`, `Question ${i}2`]
                };

                // Store in cache
                await aiCacheService.cacheResponse(
                    cacheKey,
                    'test_generation',
                    lectureIds,
                    { questionsCount: 10, requestId: i },
                    contentHash,
                    mockResponse,
                    1000,
                    content.length
                );

                // Retrieve from cache
                const cached = await aiCacheService.getCachedResponse(cacheKey);
                return { cacheKey, cached, expectedResponse: mockResponse };
            });

            const startTime = Date.now();
            const results = await Promise.all(cachePromises);
            const endTime = Date.now();

            // Verify all operations completed successfully
            expect(results).toHaveLength(concurrentRequests);
            results.forEach((result, i) => {
                expect(result.cached).not.toBeNull();
                expect(result.cached?.response_data).toEqual(result.expectedResponse);
            });

            // Performance assertion: should complete within reasonable time
            const totalTime = endTime - startTime;
            console.log(`✅ Concurrent operations (${concurrentRequests}) completed in ${totalTime}ms`);
            expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
        });

        it('should maintain performance with database latency simulation', async () => {
            // Simulate 10ms database latency
            mockOperationDelay = 10;

            const requestCount = 20;
            const lectureIds = ['550e8400-e29b-41d4-a716-446655440002'];
            const content = 'Content for latency test';
            const contentHash = contentHashService.generateHash(content);

            const operations = Array.from({ length: requestCount }, async (_, i) => {
                const cacheKey = aiCacheService.generateCacheKey({
                    operationType: 'test_generation',
                    lectureIds,
                    params: { questionsCount: 5, iteration: i },
                    contentHash
                });

                const startTime = Date.now();

                // Store response
                await aiCacheService.cacheResponse(
                    cacheKey,
                    'test_generation',
                    lectureIds,
                    { questionsCount: 5, iteration: i },
                    contentHash,
                    { questions: [`Latency Q${i}`] },
                    500,
                    content.length
                );

                // Retrieve response
                const cached = await aiCacheService.getCachedResponse(cacheKey);
                const endTime = Date.now();

                return {
                    operationTime: endTime - startTime,
                    success: cached !== null
                };
            });

            const results = await Promise.all(operations);

            // Verify all operations succeeded
            expect(results.every(r => r.success)).toBe(true);

            // Calculate average operation time
            const avgTime = results.reduce((sum, r) => sum + r.operationTime, 0) / results.length;
            console.log(`✅ Average operation time with 10ms latency: ${avgTime.toFixed(2)}ms`);

            // Should handle latency gracefully (allowing for some overhead)
            expect(avgTime).toBeLessThan(100); // Should be reasonable even with latency
        });

        it('should scale cache key generation performance', async () => {
            const keyGenerationCount = 1000;
            const lectureIds = Array.from({ length: 10 }, (_, i) =>
                `550e8400-e29b-41d4-a716-44665544000${i}`
            );
            const content = 'Performance test content for key generation';
            const contentHash = contentHashService.generateHash(content);

            const startTime = Date.now();

            // Generate many cache keys
            const keys = Array.from({ length: keyGenerationCount }, (_, i) => {
                return aiCacheService.generateCacheKey({
                    operationType: 'test_generation',
                    lectureIds: lectureIds.slice(0, (i % 5) + 1), // Vary lecture count
                    params: {
                        questionsCount: 10 + (i % 20),
                        difficulty: ['easy', 'medium', 'hard'][i % 3],
                        iteration: i
                    },
                    contentHash
                });
            });

            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Verify all keys are unique
            const uniqueKeys = new Set(keys);
            expect(uniqueKeys.size).toBe(keyGenerationCount);

            // Verify all keys are valid (64 character hex strings)
            keys.forEach(key => {
                expect(key).toMatch(/^[a-f0-9]{64}$/);
            });

            console.log(`✅ Generated ${keyGenerationCount} unique cache keys in ${totalTime}ms`);
            expect(totalTime).toBeLessThan(1000); // Should generate 1000 keys within 1 second
        });
    });

    describe('Response Time Improvement Measurement', () => {
        it('should demonstrate significant response time improvement with cache hits', async () => {
            const lectureIds = ['550e8400-e29b-41d4-a716-446655440003'];
            const content = 'Content for response time measurement';
            const contentHash = contentHashService.generateHash(content);

            const cacheKey = aiCacheService.generateCacheKey({
                operationType: 'test_generation',
                lectureIds,
                params: { questionsCount: 10 },
                contentHash
            });

            const mockResponse = {
                questions: Array.from({ length: 10 }, (_, i) => ({
                    text: `Performance question ${i}`,
                    options: ['A', 'B', 'C', 'D'],
                    correctAnswer: i % 4
                }))
            };

            // Simulate API call time (cache miss scenario)
            const simulateAPICall = async () => {
                const startTime = Date.now();
                // Simulate API processing time (100-200ms)
                await new Promise(resolve => setTimeout(resolve, 150));

                await aiCacheService.cacheResponse(
                    cacheKey,
                    'test_generation',
                    lectureIds,
                    { questionsCount: 10 },
                    contentHash,
                    mockResponse,
                    2000,
                    content.length
                );

                const endTime = Date.now();
                return endTime - startTime;
            };

            // Measure cache hit time
            const measureCacheHit = async () => {
                const startTime = Date.now();
                const cached = await aiCacheService.getCachedResponse(cacheKey);
                const endTime = Date.now();
                return {
                    time: endTime - startTime,
                    success: cached !== null
                };
            };

            // First request (cache miss + API call)
            const apiCallTime = await simulateAPICall();

            // Subsequent requests (cache hits)
            const cacheHitTimes = await Promise.all(
                Array.from({ length: 10 }, () => measureCacheHit())
            );

            // Verify all cache hits succeeded
            expect(cacheHitTimes.every(hit => hit.success)).toBe(true);

            // Calculate average cache hit time
            const avgCacheHitTime = cacheHitTimes.reduce((sum, hit) => sum + hit.time, 0) / cacheHitTimes.length;

            console.log(`✅ API call time: ${apiCallTime}ms`);
            console.log(`✅ Average cache hit time: ${avgCacheHitTime.toFixed(2)}ms`);
            console.log(`✅ Speed improvement: ${(apiCallTime / avgCacheHitTime).toFixed(1)}x faster`);

            // Cache hits should be significantly faster than API calls
            expect(avgCacheHitTime).toBeLessThan(apiCallTime / 5); // At least 5x faster
            expect(avgCacheHitTime).toBeLessThan(50); // Cache hits should be under 50ms
        });

        it('should measure content hash generation performance', async () => {
            const contentSizes = [
                { size: '1KB', content: 'x'.repeat(1024) },
                { size: '10KB', content: 'x'.repeat(10240) },
                { size: '100KB', content: 'x'.repeat(102400) },
                { size: '1MB', content: 'x'.repeat(1048576) }
            ];

            const results = [];

            for (const { size, content } of contentSizes) {
                const iterations = 10;
                const times = [];

                for (let i = 0; i < iterations; i++) {
                    const startTime = Date.now();
                    const hash = contentHashService.generateHash(content);
                    const endTime = Date.now();

                    times.push(endTime - startTime);

                    // Verify hash is valid
                    expect(hash).toMatch(/^[a-f0-9]{64}$/);
                }

                const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
                results.push({ size, avgTime });

                console.log(`✅ Hash generation for ${size}: ${avgTime.toFixed(2)}ms average`);
            }

            // Hash generation should be fast even for large content
            results.forEach(({ size, avgTime }) => {
                expect(avgTime).toBeLessThan(100); // Should be under 100ms even for 1MB
            });
        });
    });

    describe('Race Condition Prevention', () => {
        it('should handle concurrent access to same cache key without race conditions', async () => {
            const lectureIds = ['550e8400-e29b-41d4-a716-446655440004'];
            const content = 'Content for race condition test';
            const contentHash = contentHashService.generateHash(content);

            const cacheKey = aiCacheService.generateCacheKey({
                operationType: 'test_generation',
                lectureIds,
                params: { questionsCount: 10 },
                contentHash
            });

            const concurrentOperations = 20;
            const mockResponse = {
                questions: ['Race condition test question']
            };

            // Simulate concurrent cache operations on the same key
            const operations = Array.from({ length: concurrentOperations }, async (_, i) => {
                // Some operations store, others retrieve
                if (i % 2 === 0) {
                    // Store operation
                    await aiCacheService.cacheResponse(
                        cacheKey,
                        'test_generation',
                        lectureIds,
                        { questionsCount: 10 },
                        contentHash,
                        { ...mockResponse, operationId: i },
                        1000,
                        content.length
                    );
                    return { type: 'store', operationId: i };
                } else {
                    // Retrieve operation
                    const cached = await aiCacheService.getCachedResponse(cacheKey);
                    return { type: 'retrieve', cached, operationId: i };
                }
            });

            const results = await Promise.all(operations);

            // Verify no operations failed
            const storeOps = results.filter(r => r.type === 'store');
            const retrieveOps = results.filter(r => r.type === 'retrieve');

            expect(storeOps).toHaveLength(concurrentOperations / 2);
            expect(retrieveOps).toHaveLength(concurrentOperations / 2);

            // At least some retrieve operations should have found cached data
            // (depending on timing, some might not if they ran before any store operations)
            const successfulRetrieves = retrieveOps.filter(r => r.cached !== null);
            console.log(`✅ Successful retrieves: ${successfulRetrieves.length}/${retrieveOps.length}`);

            // Verify final state is consistent
            const finalCached = await aiCacheService.getCachedResponse(cacheKey);
            expect(finalCached).not.toBeNull();
            expect(finalCached?.response_data.questions).toEqual(['Race condition test question']);
        });

        it('should handle concurrent cache invalidation safely', async () => {
            const lectureId = '550e8400-e29b-41d4-a716-446655440005';
            const content = 'Content for invalidation race test';
            const contentHash = contentHashService.generateHash(content);

            // Create multiple cache entries for the same lecture
            const cacheKeys = [];
            for (let i = 0; i < 10; i++) {
                const cacheKey = aiCacheService.generateCacheKey({
                    operationType: 'test_generation',
                    lectureIds: [lectureId],
                    params: { questionsCount: 5 + i },
                    contentHash
                });
                cacheKeys.push(cacheKey);

                await aiCacheService.cacheResponse(
                    cacheKey,
                    'test_generation',
                    [lectureId],
                    { questionsCount: 5 + i },
                    contentHash,
                    { questions: [`Invalidation Q${i}`] },
                    800,
                    content.length
                );
            }

            // Verify all entries exist
            for (const cacheKey of cacheKeys) {
                const cached = await aiCacheService.getCachedResponse(cacheKey);
                expect(cached).not.toBeNull();
            }

            // Perform concurrent invalidation operations
            const invalidationPromises = Array.from({ length: 5 }, () =>
                aiCacheService.invalidateLectureCache(lectureId)
            );

            const deleteCounts = await Promise.all(invalidationPromises);

            // Verify invalidation completed
            // Note: Due to race conditions, some operations might find 0 entries to delete
            const totalDeleted = deleteCounts.reduce((sum, count) => sum + count, 0);
            console.log(`✅ Total entries deleted across concurrent operations: ${totalDeleted}`);

            // Verify all cache entries are gone
            for (const cacheKey of cacheKeys) {
                const cached = await aiCacheService.getCachedResponse(cacheKey);
                expect(cached).toBeNull();
            }
        });
    });

    describe('Large Response Handling', () => {
        it('should handle very large response data efficiently', async () => {
            const lectureIds = ['550e8400-e29b-41d4-a716-446655440006'];
            const content = 'Content for large response test';
            const contentHash = contentHashService.generateHash(content);

            // Create a very large response (simulate 1000 questions)
            const largeResponse = {
                questions: Array.from({ length: 1000 }, (_, i) => ({
                    id: i,
                    text: `Large dataset question ${i} with detailed explanation that makes the response significantly larger and tests the system's ability to handle substantial amounts of data efficiently`,
                    options: [
                        `Detailed option A for question ${i} with comprehensive explanation`,
                        `Detailed option B for question ${i} with comprehensive explanation`,
                        `Detailed option C for question ${i} with comprehensive explanation`,
                        `Detailed option D for question ${i} with comprehensive explanation`
                    ],
                    correctAnswer: i % 4,
                    explanation: `This is a comprehensive explanation for question ${i} that provides detailed reasoning and context to help students understand the concept better.`,
                    metadata: {
                        difficulty: ['easy', 'medium', 'hard'][i % 3],
                        topic: `Topic ${Math.floor(i / 10)}`,
                        estimatedTime: 60 + (i % 120),
                        tags: [`tag${i % 5}`, `category${i % 3}`]
                    }
                })),
                metadata: {
                    totalQuestions: 1000,
                    estimatedTotalTime: 90000,
                    generatedAt: new Date().toISOString(),
                    difficulty: 'mixed',
                    topics: Array.from({ length: 100 }, (_, i) => `Topic ${i}`)
                }
            };

            const cacheKey = aiCacheService.generateCacheKey({
                operationType: 'test_generation',
                lectureIds,
                params: { questionsCount: 1000 },
                contentHash
            });

            // Measure storage time
            const storeStartTime = Date.now();
            await aiCacheService.cacheResponse(
                cacheKey,
                'test_generation',
                lectureIds,
                { questionsCount: 1000 },
                contentHash,
                largeResponse,
                100000, // Large token count
                content.length
            );
            const storeEndTime = Date.now();
            const storeTime = storeEndTime - storeStartTime;

            // Measure retrieval time
            const retrieveStartTime = Date.now();
            const cached = await aiCacheService.getCachedResponse(cacheKey);
            const retrieveEndTime = Date.now();
            const retrieveTime = retrieveEndTime - retrieveStartTime;

            console.log(`✅ Large response storage time: ${storeTime}ms`);
            console.log(`✅ Large response retrieval time: ${retrieveTime}ms`);

            // Verify data integrity
            expect(cached).not.toBeNull();
            expect(cached?.response_data.questions).toHaveLength(1000);
            expect(cached?.response_data.questions[999].id).toBe(999);
            expect(cached?.response_data.metadata.totalQuestions).toBe(1000);
            expect(cached?.tokens_used).toBe(100000);

            // Performance assertions for large data
            expect(storeTime).toBeLessThan(2000); // Storage should complete within 2 seconds
            expect(retrieveTime).toBeLessThan(1000); // Retrieval should complete within 1 second

            // Test multiple retrievals of large data
            const multipleRetrievals = await Promise.all(
                Array.from({ length: 5 }, async () => {
                    const start = Date.now();
                    const result = await aiCacheService.getCachedResponse(cacheKey);
                    const end = Date.now();
                    return {
                        time: end - start,
                        success: result !== null,
                        dataSize: result?.response_data.questions.length
                    };
                })
            );

            const avgRetrievalTime = multipleRetrievals.reduce((sum, r) => sum + r.time, 0) / multipleRetrievals.length;
            console.log(`✅ Average large data retrieval time: ${avgRetrievalTime.toFixed(2)}ms`);

            // All retrievals should succeed and be fast
            expect(multipleRetrievals.every(r => r.success)).toBe(true);
            expect(multipleRetrievals.every(r => r.dataSize === 1000)).toBe(true);
            expect(avgRetrievalTime).toBeLessThan(500); // Should be consistently fast
        });

        it('should handle multiple large responses concurrently', async () => {
            const concurrentLargeRequests = 10;
            const baseContent = 'Base content for concurrent large response test';

            const operations = Array.from({ length: concurrentLargeRequests }, async (_, i) => {
                const lectureIds = [`550e8400-e29b-41d4-a716-44665544000${i}`];
                const content = `${baseContent} - Request ${i}`;
                const contentHash = contentHashService.generateHash(content);

                // Create large response for each request
                const largeResponse = {
                    questions: Array.from({ length: 200 }, (_, j) => ({
                        id: j,
                        text: `Concurrent large question ${i}-${j}`,
                        options: [`A${i}${j}`, `B${i}${j}`, `C${i}${j}`, `D${i}${j}`],
                        correctAnswer: j % 4,
                        explanation: `Explanation for concurrent question ${i}-${j}`
                    })),
                    requestId: i,
                    timestamp: new Date().toISOString()
                };

                const cacheKey = aiCacheService.generateCacheKey({
                    operationType: 'test_generation',
                    lectureIds,
                    params: { questionsCount: 200, requestId: i },
                    contentHash
                });

                const startTime = Date.now();

                // Store large response
                await aiCacheService.cacheResponse(
                    cacheKey,
                    'test_generation',
                    lectureIds,
                    { questionsCount: 200, requestId: i },
                    contentHash,
                    largeResponse,
                    20000,
                    content.length
                );

                // Retrieve large response
                const cached = await aiCacheService.getCachedResponse(cacheKey);
                const endTime = Date.now();

                return {
                    requestId: i,
                    totalTime: endTime - startTime,
                    success: cached !== null,
                    dataIntegrity: cached?.response_data.requestId === i,
                    questionCount: cached?.response_data.questions.length
                };
            });

            const startTime = Date.now();
            const results = await Promise.all(operations);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            console.log(`✅ Concurrent large responses (${concurrentLargeRequests}) completed in ${totalTime}ms`);

            // Verify all operations succeeded
            expect(results.every(r => r.success)).toBe(true);
            expect(results.every(r => r.dataIntegrity)).toBe(true);
            expect(results.every(r => r.questionCount === 200)).toBe(true);

            // Calculate performance metrics
            const avgOperationTime = results.reduce((sum, r) => sum + r.totalTime, 0) / results.length;
            console.log(`✅ Average operation time for large responses: ${avgOperationTime.toFixed(2)}ms`);

            // Performance assertions
            expect(totalTime).toBeLessThan(10000); // All operations within 10 seconds
            expect(avgOperationTime).toBeLessThan(2000); // Each operation within 2 seconds
        });
    });
});