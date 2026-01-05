import { describe, it, expect, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { ContentHashService } from '../services/contentHash';

describe('ContentHashService', () => {
    const service = new ContentHashService();

    /**
     * Feature: ai-response-caching, Property 9: Cache key determinism
     * Validates: Requirements 5.1-5.5
     * 
     * For any request parameters, generating the cache key multiple times 
     * with the same parameters should always produce the same key
     */
    describe('Property 9: Hash determinism', () => {
        it('should generate identical hashes for the same content', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 1000 }),
                    (content) => {
                        // Generate hash multiple times
                        const hash1 = service.generateHash(content);
                        const hash2 = service.generateHash(content);
                        const hash3 = service.generateHash(content);

                        // All hashes should be identical
                        expect(hash1).toBe(hash2);
                        expect(hash2).toBe(hash3);
                        expect(hash1).toBe(hash3);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate identical hashes regardless of whitespace variations', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 500 }),
                    (baseContent) => {
                        // Create variations with different whitespace
                        const variations = [
                            baseContent,
                            `  ${baseContent}  `, // leading/trailing spaces
                            baseContent.replace(/\s+/g, ' '), // normalized spaces
                            `\n${baseContent}\n`, // newlines
                            `\t${baseContent}\t`, // tabs
                            baseContent.toUpperCase(), // uppercase (should normalize to lowercase)
                            baseContent.toLowerCase(), // lowercase
                        ];

                        // All variations should produce the same hash
                        const hashes = variations.map(v => service.generateHash(v));
                        const firstHash = hashes[0];

                        hashes.forEach((hash, index) => {
                            expect(hash).toBe(firstHash);
                        });
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate consistent 64-character hex hashes', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 0, maxLength: 1000 }),
                    (content) => {
                        const hash = service.generateHash(content);

                        // SHA-256 produces 64 hex characters
                        expect(hash).toHaveLength(64);
                        expect(hash).toMatch(/^[a-f0-9]{64}$/);
                    }
                ),
                { numRuns: 100 }
            );
        });

        it('should generate different hashes for different content', () => {
            fc.assert(
                fc.property(
                    fc.string({ minLength: 1, maxLength: 500 }),
                    fc.string({ minLength: 1, maxLength: 500 }),
                    (content1, content2) => {
                        // Skip if contents normalize to the same value
                        const normalized1 = content1.trim().toLowerCase().replace(/\s+/g, ' ');
                        const normalized2 = content2.trim().toLowerCase().replace(/\s+/g, ' ');

                        if (normalized1 === normalized2) {
                            return true; // Skip this case
                        }

                        const hash1 = service.generateHash(content1);
                        const hash2 = service.generateHash(content2);

                        // Different content should produce different hashes
                        expect(hash1).not.toBe(hash2);
                    }
                ),
                { numRuns: 100 }
            );
        });
    });
});

/**
 * Feature: ai-response-caching, Property 5: Content change invalidates cache
 * Validates: Requirements 1.5, 7.1-7.5
 * 
 * For any lecture, when its content hash changes, subsequent requests 
 * should not use old cached responses and should generate new ones
 */
describe('Property 5: Content change detection', () => {
    const service = new ContentHashService();
    const testLectureIds: string[] = [];

    afterEach(async () => {
        // Clean up test data
        if (testLectureIds.length > 0) {
            const { supabase } = await import('../config/supabase');
            await supabase
                .from('lecture_content_hashes')
                .delete()
                .in('lecture_id', testLectureIds);
            testLectureIds.length = 0;
        }
    });

    it('should detect content changes when hash differs', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.string({ minLength: 10, maxLength: 500 }),
                fc.string({ minLength: 10, maxLength: 500 }),
                async (lectureId, content1, content2) => {
                    // Ensure contents are actually different after normalization
                    const normalized1 = content1.trim().toLowerCase().replace(/\s+/g, ' ');
                    const normalized2 = content2.trim().toLowerCase().replace(/\s+/g, ' ');

                    if (normalized1 === normalized2) {
                        return true; // Skip this case
                    }

                    testLectureIds.push(lectureId);

                    // Store initial hash
                    const hash1 = service.generateHash(content1);
                    await service.updateLectureHash(lectureId, hash1);

                    // Check with same content - should not detect change
                    const changed1 = await service.hasContentChanged(lectureId, content1);
                    expect(changed1).toBe(false);

                    // Check with different content - should detect change
                    const changed2 = await service.hasContentChanged(lectureId, content2);
                    expect(changed2).toBe(true);
                }
            ),
            { numRuns: 20 } // Reduced runs for database operations
        );
    });

    it('should return true for lectures with no stored hash', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.string({ minLength: 10, maxLength: 500 }),
                async (lectureId, content) => {
                    // For a lecture with no stored hash, should always return true
                    const changed = await service.hasContentChanged(lectureId, content);
                    expect(changed).toBe(true);
                }
            ),
            { numRuns: 20 }
        );
    });

    it('should not detect change for equivalent content with different whitespace', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.string({ minLength: 10, maxLength: 500 }),
                async (lectureId, baseContent) => {
                    testLectureIds.push(lectureId);

                    // Store initial hash
                    const hash = service.generateHash(baseContent);
                    await service.updateLectureHash(lectureId, hash);

                    // Create variations with different whitespace
                    const variations = [
                        baseContent,
                        `  ${baseContent}  `,
                        baseContent.replace(/\s+/g, ' '),
                        `\n${baseContent}\n`,
                        baseContent.toUpperCase(),
                        baseContent.toLowerCase(),
                    ];

                    // None of these should be detected as changes
                    for (const variation of variations) {
                        const changed = await service.hasContentChanged(lectureId, variation);
                        expect(changed).toBe(false);
                    }
                }
            ),
            { numRuns: 20 }
        );
    });

    it('should correctly update hash when content changes', async () => {
        await fc.assert(
            fc.asyncProperty(
                fc.uuid(),
                fc.string({ minLength: 10, maxLength: 500 }),
                fc.string({ minLength: 10, maxLength: 500 }),
                async (lectureId, content1, content2) => {
                    // Ensure contents are different
                    const normalized1 = content1.trim().toLowerCase().replace(/\s+/g, ' ');
                    const normalized2 = content2.trim().toLowerCase().replace(/\s+/g, ' ');

                    if (normalized1 === normalized2) {
                        return true;
                    }

                    testLectureIds.push(lectureId);

                    // Store first hash
                    const hash1 = service.generateHash(content1);
                    await service.updateLectureHash(lectureId, hash1);

                    // Verify first content doesn't show as changed
                    const changed1 = await service.hasContentChanged(lectureId, content1);
                    expect(changed1).toBe(false);

                    // Update to second hash
                    const hash2 = service.generateHash(content2);
                    await service.updateLectureHash(lectureId, hash2);

                    // Now first content should show as changed
                    const changed2 = await service.hasContentChanged(lectureId, content1);
                    expect(changed2).toBe(true);

                    // But second content should not
                    const changed3 = await service.hasContentChanged(lectureId, content2);
                    expect(changed3).toBe(false);
                }
            ),
            { numRuns: 20 }
        );
    });
});
