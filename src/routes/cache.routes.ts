import { Router } from 'express';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import { aiCacheService } from '../services/aiCache';

const router = Router();

/**
 * GET /api/cache/stats
 * 
 * Get comprehensive cache statistics
 * 
 * Authentication: Required (admin only)
 * Requirements: 3.1, 8.5
 */
router.get('/stats', authenticate, authorize('admin'), async (req, res) => {
    try {
        const stats = await aiCacheService.getCacheStats();

        res.json({
            success: true,
            data: stats
        });
    } catch (error: any) {
        console.error('Error getting cache stats:', error);
        res.status(500).json({
            success: false,
            message: 'Помилка отримання статистики кешу',
            error: error.message
        });
    }
});

/**
 * DELETE /api/cache/lecture/:lectureId
 * 
 * Invalidate all cache entries for a specific lecture
 * 
 * Authentication: Required (teacher/admin)
 * Requirements: 3.2
 */
router.delete('/lecture/:lectureId', authenticate, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { lectureId } = req.params;

        if (!lectureId) {
            return res.status(400).json({
                success: false,
                message: 'ID лекції обов\'язковий'
            });
        }

        const deletedCount = await aiCacheService.invalidateLectureCache(lectureId);

        res.json({
            success: true,
            message: `Кеш для лекції успішно очищено`,
            data: {
                lectureId,
                deletedEntries: deletedCount
            }
        });
    } catch (error: any) {
        console.error('Error invalidating lecture cache:', error);
        res.status(500).json({
            success: false,
            message: 'Помилка очищення кешу лекції',
            error: error.message
        });
    }
});

/**
 * DELETE /api/cache/old
 * 
 * Clear cache entries older than specified days
 * 
 * Authentication: Required (admin only)
 * Requirements: 3.3
 */
router.delete('/old', authenticate, authorize('admin'), async (req, res) => {
    try {
        // Get days parameter from query string, default to 30
        const days = parseInt(req.query.days as string) || 30;

        if (days < 1) {
            return res.status(400).json({
                success: false,
                message: 'Кількість днів має бути більше 0'
            });
        }

        const deletedCount = await aiCacheService.clearOldCache(days);

        res.json({
            success: true,
            message: `Старий кеш успішно очищено`,
            data: {
                olderThanDays: days,
                deletedEntries: deletedCount
            }
        });
    } catch (error: any) {
        console.error('Error clearing old cache:', error);
        res.status(500).json({
            success: false,
            message: 'Помилка очищення старого кешу',
            error: error.message
        });
    }
});

/**
 * DELETE /api/cache/all
 * 
 * Clear all cache entries
 * 
 * Authentication: Required (admin only)
 * Requirements: 3.4
 * 
 * Note: Requires confirmation parameter to prevent accidental deletion
 */
router.delete('/all', authenticate, authorize('admin'), async (req, res) => {
    try {
        // Require confirmation to prevent accidental deletion
        const { confirm } = req.body;

        if (confirm !== 'DELETE_ALL_CACHE') {
            return res.status(400).json({
                success: false,
                message: 'Підтвердження обов\'язкове. Надішліть { "confirm": "DELETE_ALL_CACHE" } для підтвердження'
            });
        }

        await aiCacheService.clearAllCache();

        res.json({
            success: true,
            message: 'Весь кеш успішно очищено'
        });
    } catch (error: any) {
        console.error('Error clearing all cache:', error);
        res.status(500).json({
            success: false,
            message: 'Помилка очищення всього кешу',
            error: error.message
        });
    }
});

export default router;
