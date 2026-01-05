import { Router } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Create group (teacher only)
router.post('/', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { name } = req.body;

        const { data, error } = await supabase
            .from('groups')
            .insert({ name, teacher_id: user.id })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get teacher's groups
router.get('/', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const user = (req as AuthRequest).user;

        const { data, error } = await supabase
            .from('groups')
            .select(`
        *,
        group_members (
          student:profiles (*)
        )
      `)
            .eq('teacher_id', user.id);

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Add student to group
router.post('/:groupId/members', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { groupId } = req.params;
        const { studentId } = req.body;

        const { data, error } = await supabase
            .from('group_members')
            .insert({ group_id: groupId, student_id: studentId })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Remove student from group
router.delete('/:groupId/members/:studentId', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { groupId, studentId } = req.params;

        const { error } = await supabase
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('student_id', studentId);

        if (error) throw error;
        res.json({ message: 'Студента видалено з групи' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
