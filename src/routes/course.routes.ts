import { Router } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

// Get all courses
router.get('/', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;

        if (user.role === 'teacher') {
            // Teacher sees their own courses with statistics
            const { data, error } = await supabase
                .from('courses')
                .select(`
                    *,
                    lectures (id),
                    course_enrollments (id)
                `)
                .eq('teacher_id', user.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to include counts
            const courses = data?.map(course => ({
                id: course.id,
                title: course.title,
                description: course.description,
                coverImageUrl: course.cover_image_url,
                status: course.status || 'ACTIVE',
                studentsCount: course.course_enrollments?.length || 0,
                totalLectures: course.lectures?.length || 0,
                updatedDate: course.updated_at || course.created_at,
                createdAt: course.created_at
            })) || [];

            return res.json(courses);
        }

        // Students see only enrolled courses
        const { data, error } = await supabase
            .from('course_enrollments')
            .select(`
        course:courses (
          *,
          teacher:profiles!courses_teacher_id_fkey (
            first_name,
            last_name
          )
        ),
        enrolled_at,
        status,
        progress
      `)
            .eq('student_id', user.id)
            .eq('status', 'active')
            .order('enrolled_at', { ascending: false });

        if (error) throw error;

        // Transform data to match expected format
        const courses = data?.map(enrollment => ({
            ...enrollment.course,
            enrollment: {
                enrolled_at: enrollment.enrolled_at,
                status: enrollment.status,
                progress: enrollment.progress
            }
        })) || [];

        res.json(courses);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get course by ID
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('courses')
            .select(`
        *,
        teacher:profiles!courses_teacher_id_fkey (
          first_name,
          last_name
        ),
        lectures (
          id,
          title,
          created_at
        )
      `)
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(404).json({ message: 'Курс не знайдено' });
    }
});

// Create course (teacher only)
router.post('/', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { title, description } = req.body;

        console.log('[Course Create] Creating course for user:', user.id);

        const { data, error } = await supabase
            .from('courses')
            .insert({
                title,
                description,
                teacher_id: user.id
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Update course
router.put('/:id', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { title, description } = req.body;

        const { data, error } = await supabase
            .from('courses')
            .update({ title, description, updated_at: new Date().toISOString() })
            .eq('id', req.params.id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Delete course
router.delete('/:id', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { error } = await supabase
            .from('courses')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ message: 'Курс видалено' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Enroll student in course (teacher only)
router.post('/:id/enroll', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { studentId } = req.body;
        const courseId = req.params.id;

        // Check if already enrolled
        const { data: existing } = await supabase
            .from('course_enrollments')
            .select('id')
            .eq('course_id', courseId)
            .eq('student_id', studentId)
            .single();

        if (existing) {
            return res.status(400).json({ message: 'Студент вже записаний на цей курс' });
        }

        const { data, error } = await supabase
            .from('course_enrollments')
            .insert({
                course_id: courseId,
                student_id: studentId
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Remove student from course (teacher only)
router.delete('/:id/enroll/:studentId', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { id: courseId, studentId } = req.params;

        const { error } = await supabase
            .from('course_enrollments')
            .delete()
            .eq('course_id', courseId)
            .eq('student_id', studentId);

        if (error) throw error;
        res.json({ message: 'Студента видалено з курсу' });
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get enrolled students for a course (teacher only)
router.get('/:id/students', authenticate, authorize('teacher'), async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('course_enrollments')
            .select(`
        *,
        student:profiles!course_enrollments_student_id_fkey (
          id,
          first_name,
          last_name,
          email,
          user_name
        )
      `)
            .eq('course_id', req.params.id)
            .order('enrolled_at', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get lectures for a course
router.get('/:id/lectures', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const courseId = req.params.id;

        if (user.role === 'teacher') {
            // Teacher sees all lectures with statistics
            const { data, error } = await supabase
                .from('lectures')
                .select('*')
                .eq('course_id', courseId)
                .order('created_at', { ascending: true });

            if (error) throw error;
            res.json(data || []);
        } else {
            // Student sees lectures with completion status
            const { data, error } = await supabase
                .from('lectures')
                .select(`
          *,
          student_progress!left (
            completed,
            last_accessed
          )
        `)
                .eq('course_id', courseId)
                .eq('student_progress.student_id', user.id)
                .order('created_at', { ascending: true });

            if (error) throw error;

            // Transform data to include completion status
            const lectures = data?.map(lecture => ({
                ...lecture,
                completed: lecture.student_progress?.[0]?.completed || false,
                lastAccessed: lecture.student_progress?.[0]?.last_accessed || null
            })) || [];

            res.json(lectures);
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Mark lecture as completed (student only)
router.post('/:courseId/lectures/:lectureId/complete', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const { courseId, lectureId } = req.params;

        // Check if already completed
        const { data: existing } = await supabase
            .from('student_progress')
            .select('id, completed')
            .eq('student_id', user.id)
            .eq('lecture_id', lectureId)
            .single();

        if (existing) {
            // Toggle completion
            const { data, error } = await supabase
                .from('student_progress')
                .update({
                    completed: !existing.completed,
                    last_accessed: new Date().toISOString()
                })
                .eq('id', existing.id)
                .select()
                .single();

            if (error) throw error;
            return res.json(data);
        }

        // Create new progress record
        const { data, error } = await supabase
            .from('student_progress')
            .insert({
                student_id: user.id,
                course_id: courseId,
                lecture_id: lectureId,
                completed: true,
                last_accessed: new Date().toISOString()
            })
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

// Get tests for a course
router.get('/:id/tests', authenticate, async (req, res) => {
    try {
        const user = (req as AuthRequest).user;
        const courseId = req.params.id;
        const role = req.query.role as string;

        if (role === 'teacher' || user.role === 'teacher') {
            // Teacher sees all tests with statistics
            const { data, error } = await supabase
                .from('tests')
                .select('*')
                .eq('course_id', courseId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            res.json(data || []);
        } else {
            // Student sees only published tests with their attempts
            const { data, error } = await supabase
                .from('tests')
                .select(`
          *,
          test_submissions!left (
            id,
            score,
            submitted_at,
            status
          )
        `)
                .eq('course_id', courseId)
                .eq('is_published', true)
                .order('created_at', { ascending: false });

            if (error) throw error;

            // Transform data to include submission info
            const tests = data?.map(test => ({
                ...test,
                submissions: test.test_submissions || []
            })) || [];

            res.json(tests);
        }
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

export default router;
