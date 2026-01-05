import { Router } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Get teacher statistics
router.get('/teacher', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const user = (req as AuthRequest).user;

        // Get courses count
        const { count: coursesCount } = await supabase
            .from('courses')
            .select('*', { count: 'exact', head: true })
            .eq('teacher_id', user.id);

        // Get students count (from groups)
        const { data: groups } = await supabase
            .from('groups')
            .select('id')
            .eq('teacher_id', user.id);

        const groupIds = groups?.map(g => g.id) || [];

        const { count: studentsCount } = await supabase
            .from('group_members')
            .select('*', { count: 'exact', head: true })
            .in('group_id', groupIds);

        // Get tests count
        const { count: testsCount } = await supabase
            .from('tests')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', user.id);

        res.json({
            coursesCount: coursesCount || 0,
            studentsCount: studentsCount || 0,
            testsCount: testsCount || 0
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get student statistics for teacher
router.get('/students/:studentId', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { studentId } = req.params;

        // Get all test submissions
        const { data: submissions } = await supabase
            .from('test_submissions')
            .select(`
        *,
        test:tests (
          title,
          course:courses (title)
        )
      `)
            .eq('student_id', studentId)
            .order('submitted_at', { ascending: false });

        // Calculate average score
        const completedSubmissions = submissions?.filter(s => s.submitted_at) || [];
        const averageScore = completedSubmissions.length > 0
            ? completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length
            : 0;

        res.json({
            submissions,
            averageScore: Math.round(averageScore),
            totalTests: completedSubmissions.length
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get student's own statistics
router.get('/student/me', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;

        // Get test submissions
        const { data: submissions } = await supabase
            .from('test_submissions')
            .select(`
        *,
        test:tests (
          title,
          course:courses (title)
        )
      `)
            .eq('student_id', user.id)
            .order('submitted_at', { ascending: false });

        // Calculate statistics
        const completedSubmissions = submissions?.filter(s => s.submitted_at) || [];
        const averageScore = completedSubmissions.length > 0
            ? completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length
            : 0;

        // Get progress
        const { data: progress } = await supabase
            .from('student_progress')
            .select(`
        *,
        lecture:lectures (
          title,
          course:courses (title)
        )
      `)
            .eq('student_id', user.id);

        const completedLectures = progress?.filter(p => p.completed).length || 0;
        const totalLectures = progress?.length || 0;

        res.json({
            averageScore: Math.round(averageScore),
            totalTests: completedSubmissions.length,
            completedLectures,
            totalLectures,
            progressPercentage: totalLectures > 0 ? Math.round((completedLectures / totalLectures) * 100) : 0,
            recentSubmissions: submissions?.slice(0, 5)
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get group statistics
router.get('/group/:groupId', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { groupId } = req.params;

        // Get all students in group
        const { data: members } = await supabase
            .from('group_members')
            .select('student_id')
            .eq('group_id', groupId);

        const studentIds = members?.map(m => m.student_id) || [];

        // Get submissions for all students
        const { data: submissions } = await supabase
            .from('test_submissions')
            .select(`
        *,
        student:profiles (first_name, last_name)
      `)
            .in('student_id', studentIds);

        // Calculate group average
        const completedSubmissions = submissions?.filter(s => s.submitted_at) || [];
        const groupAverage = completedSubmissions.length > 0
            ? completedSubmissions.reduce((sum, s) => sum + (s.percentage || 0), 0) / completedSubmissions.length
            : 0;

        res.json({
            studentsCount: studentIds.length,
            groupAverage: Math.round(groupAverage),
            totalSubmissions: completedSubmissions.length,
            submissions
        });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
