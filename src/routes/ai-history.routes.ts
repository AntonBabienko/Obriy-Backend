import { Router } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// Get AI history for a specific lecture
router.get('/lecture/:lectureId', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { lectureId } = req.params;

        const { data, error } = await supabase
            .from('ai_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('lecture_id', lectureId)
            .order('created_at', { ascending: false })
            .limit(50); // Limit to latest 50 entries

        if (error) throw error;

        res.json(data || []);
    } catch (error) {
        console.error('Error fetching AI history:', error);
        res.status(500).json({ error: 'Failed to fetch AI history' });
    }
});

// Save AI result to history
router.post('/', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { lectureId, toolType, resultData, processingTime, contentHash } = req.body;

        // Validate required fields
        if (!lectureId || !toolType || !resultData || processingTime === undefined || !contentHash) {
            return res.status(400).json({
                error: 'Missing required fields: lectureId, toolType, resultData, processingTime, contentHash'
            });
        }

        // Validate tool type
        const validToolTypes = ['summary', 'quiz', 'flashcards', 'mindmap', 'chat', 'ukrainian-educational', 'analysis'];
        if (!validToolTypes.includes(toolType)) {
            return res.status(400).json({
                error: `Invalid tool type. Must be one of: ${validToolTypes.join(', ')}`
            });
        }

        // Insert new AI history entry
        const { data, error } = await supabase
            .from('ai_history')
            .insert({
                user_id: user.id,
                lecture_id: lectureId,
                tool_type: toolType,
                result_data: resultData,
                processing_time: parseInt(processingTime),
                content_hash: contentHash
            })
            .select()
            .single();

        if (error) throw error;

        // Cleanup old entries for this user/lecture combination
        await cleanupOldEntries(user.id, lectureId);

        res.status(201).json(data);
    } catch (error) {
        console.error('Error saving AI history:', error);
        res.status(500).json({ error: 'Failed to save AI history' });
    }
});

// Get specific AI history entry
router.get('/:id', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { id } = req.params;

        const { data, error } = await supabase
            .from('ai_history')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'AI history entry not found' });
            }
            throw error;
        }

        res.json(data);
    } catch (error) {
        console.error('Error fetching AI history entry:', error);
        res.status(500).json({ error: 'Failed to fetch AI history entry' });
    }
});

// Delete AI history entry
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { id } = req.params;

        const { error } = await supabase
            .from('ai_history')
            .delete()
            .eq('id', id)
            .eq('user_id', user.id);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        console.error('Error deleting AI history entry:', error);
        res.status(500).json({ error: 'Failed to delete AI history entry' });
    }
});

// Clear all AI history for a specific lecture
router.delete('/lecture/:lectureId', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { lectureId } = req.params;

        const { error } = await supabase
            .from('ai_history')
            .delete()
            .eq('user_id', user.id)
            .eq('lecture_id', lectureId);

        if (error) throw error;

        res.status(204).send();
    } catch (error) {
        console.error('Error clearing AI history:', error);
        res.status(500).json({ error: 'Failed to clear AI history' });
    }
});

// Export AI history for a specific lecture
router.get('/lecture/:lectureId/export', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { lectureId } = req.params;
        const { format = 'json' } = req.query;

        const { data, error } = await supabase
            .from('ai_history')
            .select('*')
            .eq('user_id', user.id)
            .eq('lecture_id', lectureId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (format === 'csv') {
            // Convert to CSV format
            const csvData = convertToCSV(data || []);
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="ai-history-lecture-${lectureId}.csv"`);
            res.send(csvData);
        } else {
            // Return as JSON
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="ai-history-lecture-${lectureId}.json"`);
            res.json(data || []);
        }
    } catch (error) {
        console.error('Error exporting AI history:', error);
        res.status(500).json({ error: 'Failed to export AI history' });
    }
});

// Helper function to cleanup old entries
async function cleanupOldEntries(userId: string, lectureId: string) {
    try {
        // Get all entries for this user/lecture, ordered by creation date
        const { data, error } = await supabase
            .from('ai_history')
            .select('id')
            .eq('user_id', userId)
            .eq('lecture_id', lectureId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // If more than 50 entries, delete the oldest ones
        if (data && data.length > 50) {
            const idsToDelete = data.slice(50).map(entry => entry.id);

            const { error: deleteError } = await supabase
                .from('ai_history')
                .delete()
                .in('id', idsToDelete);

            if (deleteError) throw deleteError;
        }
    } catch (error) {
        console.error('Error cleaning up old AI history entries:', error);
        // Don't throw error here as it's a cleanup operation
    }
}

// Helper function to convert data to CSV
function convertToCSV(data: any[]): string {
    if (data.length === 0) {
        return 'id,tool_type,created_at,processing_time,content_hash,data_preview\n';
    }

    const headers = 'id,tool_type,created_at,processing_time,content_hash,data_preview\n';

    const rows = data.map(entry => {
        const dataPreview = getDataPreview(entry.result_data, entry.tool_type);
        const createdAt = new Date(entry.created_at).toISOString();

        return [
            entry.id,
            entry.tool_type,
            createdAt,
            entry.processing_time.toString(),
            `"${entry.content_hash.replace(/"/g, '""')}"`, // Properly escape quotes
            `"${dataPreview.replace(/"/g, '""')}"`
        ].join(',');
    }).join('\n');

    return headers + rows;
}

// Helper function to get data preview for CSV export
function getDataPreview(data: any, toolType: string): string {
    try {
        switch (toolType) {
            case 'summary':
                return data.sections?.keyConcepts?.[0] || 'Summary generated';
            case 'quiz':
                return data.questions?.[0]?.question || 'Quiz generated';
            case 'flashcards':
                return data.cards?.[0]?.front || 'Flashcards generated';
            case 'mindmap':
                return data.title || 'Mind map generated';
            case 'chat':
                return data.response?.substring(0, 100) || 'Chat response';
            default:
                return 'AI result generated';
        }
    } catch (error) {
        return 'Data preview unavailable';
    }
}

export default router;