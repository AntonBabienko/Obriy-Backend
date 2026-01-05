import crypto from 'crypto';
import { supabase } from '../config/supabase';

/**
 * Service for generating and managing content hashes for cache invalidation
 */
export class ContentHashService {
    /**
     * Generate SHA-256 hash of content with normalization
     * Normalization ensures consistent hashing regardless of whitespace variations
     * 
     * @param content - The content to hash
     * @returns SHA-256 hash as hex string
     */
    generateHash(content: string): string {
        // Normalize content: trim, lowercase, collapse whitespace
        const normalized = content
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');

        // Generate SHA-256 hash
        return crypto
            .createHash('sha256')
            .update(normalized)
            .digest('hex');
    }

    /**
     * Get stored hash for a lecture from database
     * 
     * @param lectureId - UUID of the lecture
     * @returns The stored content hash, or null if not found
     */
    async getLectureHash(lectureId: string): Promise<string | null> {
        try {
            const { data, error } = await supabase
                .from('lecture_content_hashes')
                .select('content_hash')
                .eq('lecture_id', lectureId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - lecture hash not yet stored
                    return null;
                }
                throw error;
            }

            return data?.content_hash || null;
        } catch (error) {
            console.error('Error fetching lecture hash:', error);
            throw new Error(`Failed to fetch lecture hash: ${error}`);
        }
    }

    /**
     * Update or insert the content hash for a lecture
     * 
     * @param lectureId - UUID of the lecture
     * @param newHash - The new content hash to store
     */
    async updateLectureHash(lectureId: string, newHash: string): Promise<void> {
        try {
            const { error } = await supabase
                .from('lecture_content_hashes')
                .upsert({
                    lecture_id: lectureId,
                    content_hash: newHash,
                    updated_at: new Date().toISOString()
                }, {
                    onConflict: 'lecture_id'
                });

            if (error) {
                throw error;
            }

            console.log(`✅ Updated content hash for lecture ${lectureId}`);
        } catch (error) {
            console.error('Error updating lecture hash:', error);
            throw new Error(`Failed to update lecture hash: ${error}`);
        }
    }

    /**
     * Check if lecture content has changed by comparing hashes
     * 
     * @param lectureId - UUID of the lecture
     * @param currentContent - The current content to check
     * @returns true if content has changed, false if unchanged
     */
    async hasContentChanged(lectureId: string, currentContent: string): Promise<boolean> {
        try {
            const storedHash = await this.getLectureHash(lectureId);

            // If no stored hash, consider it changed (first time)
            if (!storedHash) {
                return true;
            }

            const currentHash = this.generateHash(currentContent);
            return storedHash !== currentHash;
        } catch (error) {
            console.error('Error checking content change:', error);
            // On error, assume content changed to be safe
            return true;
        }
    }
}

// Export singleton instance
export const contentHashService = new ContentHashService();
