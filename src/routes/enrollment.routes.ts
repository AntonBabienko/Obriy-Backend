import { Router } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * POST /api/enrollments
 * Записати студента на курс (тільки викладачі)
 * Приймає courseId та studentUserName (username)
 */
router.post('/', authenticate, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { courseId, studentId, studentUserName } = req.body;
        const user = (req as AuthRequest).user;

        // Перевірити, що курс належить викладачу
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('id, teacher_id')
            .eq('id', courseId)
            .eq('teacher_id', user.id)
            .single();

        if (courseError || !course) {
            return res.status(404).json({ message: 'Курс не знайдено або ви не маєте прав' });
        }

        let actualStudentId = studentId;

        // Якщо передано studentUserName замість studentId, знайти студента
        if (studentUserName && !studentId) {
            const { data: student, error: studentError } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_name', studentUserName)
                .eq('role', 'student')
                .single();

            if (studentError || !student) {
                return res.status(404).json({ message: `Студента з username "${studentUserName}" не знайдено` });
            }

            actualStudentId = student.id;
        }

        if (!actualStudentId) {
            return res.status(400).json({ message: 'Потрібно вказати studentId або studentUserName' });
        }

        // Записати студента
        const { data: enrollment, error: enrollError } = await supabase
            .from('course_enrollments')
            .insert({
                course_id: courseId,
                student_id: actualStudentId,
                status: 'active',
                progress: 0
            })
            .select()
            .single();

        if (enrollError) {
            if (enrollError.code === '23505') { // Unique constraint violation
                return res.status(409).json({ message: 'Студент вже записаний на цей курс' });
            }
            throw enrollError;
        }

        res.status(201).json(enrollment);
    } catch (error: any) {
        console.error('Error enrolling student:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * GET /api/enrollments/search-students?q=username
 * Пошук студентів за username (для автокомплету)
 */
router.get('/search-students', authenticate, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.length < 2) {
            return res.json([]);
        }

        const searchTerm = q.toLowerCase().replace(/^@/, '');

        const { data: students, error } = await supabase
            .from('profiles')
            .select('id, user_name, first_name, last_name')
            .eq('role', 'student')
            .ilike('user_name', `%${searchTerm}%`)
            .limit(10);

        if (error) throw error;

        res.json(students || []);
    } catch (error: any) {
        console.error('Error searching students:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * GET /api/enrollments/course/:courseId
 * Отримати список студентів на курсі (тільки викладачі)
 */
router.get('/course/:courseId', authenticate, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { courseId } = req.params;
        const user = (req as AuthRequest).user;

        // Перевірити права на курс
        const { data: course, error: courseError } = await supabase
            .from('courses')
            .select('id')
            .eq('id', courseId)
            .eq('teacher_id', user.id)
            .single();

        if (courseError || !course) {
            return res.status(404).json({ message: 'Курс не знайдено або ви не маєте прав' });
        }

        // Отримати список студентів
        const { data: enrollments, error } = await supabase
            .from('course_enrollments')
            .select(`
                id,
                enrolled_at,
                status,
                progress,
                student:profiles!course_enrollments_student_id_fkey (
                    id,
                    first_name,
                    last_name,
                    user_name
                )
            `)
            .eq('course_id', courseId)
            .order('enrolled_at', { ascending: false });

        if (error) throw error;

        res.json(enrollments);
    } catch (error: any) {
        console.error('Error fetching course enrollments:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * GET /api/enrollments/my-courses
 * Отримати курси студента (тільки студенти)
 */
router.get('/my-courses', authenticate, authorize('student'), async (req, res) => {
    try {
        const user = (req as AuthRequest).user;

        const { data: enrollments, error } = await supabase
            .from('course_enrollments')
            .select(`
                id,
                enrolled_at,
                status,
                progress,
                course:courses!course_enrollments_course_id_fkey (
                    id,
                    title,
                    description,
                    created_at,
                    teacher:profiles!courses_teacher_id_fkey (
                        first_name,
                        last_name
                    )
                )
            `)
            .eq('student_id', user.id)
            .eq('status', 'active')
            .order('enrolled_at', { ascending: false });

        if (error) throw error;

        res.json(enrollments);
    } catch (error: any) {
        console.error('Error fetching student courses:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * PUT /api/enrollments/:enrollmentId/progress
 * Оновити прогрес студента (студенти та викладачі)
 */
router.put('/:enrollmentId/progress', authenticate, async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const { progress } = req.body;
        const user = (req as AuthRequest).user;

        if (progress < 0 || progress > 100) {
            return res.status(400).json({ message: 'Прогрес має бути від 0 до 100' });
        }

        // Перевірити права
        let query = supabase
            .from('course_enrollments')
            .select('id, student_id, course_id, courses!course_enrollments_course_id_fkey(teacher_id)')
            .eq('id', enrollmentId);

        const { data: enrollment, error: fetchError } = await query.single();

        if (fetchError || !enrollment) {
            return res.status(404).json({ message: 'Запис не знайдено' });
        }

        // Студент може оновлювати тільки свій прогрес
        // Викладач може оновлювати прогрес студентів на своїх курсах
        const course = enrollment.courses as any;
        const canUpdate =
            (user.role === 'student' && enrollment.student_id === user.id) ||
            (['teacher', 'admin'].includes(user.role) && course.teacher_id === user.id);

        if (!canUpdate) {
            return res.status(403).json({ message: 'Недостатньо прав для оновлення прогресу' });
        }

        // Оновити прогрес
        const { data: updated, error: updateError } = await supabase
            .from('course_enrollments')
            .update({
                progress,
                status: progress === 100 ? 'completed' : 'active'
            })
            .eq('id', enrollmentId)
            .select()
            .single();

        if (updateError) throw updateError;

        res.json(updated);
    } catch (error: any) {
        console.error('Error updating progress:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * DELETE /api/enrollments/:enrollmentId
 * Видалити студента з курсу (тільки викладачі)
 */
router.delete('/:enrollmentId', authenticate, authorize('teacher', 'admin'), async (req, res) => {
    try {
        const { enrollmentId } = req.params;
        const user = (req as AuthRequest).user;

        // Перевірити права
        const { data: enrollment, error: fetchError } = await supabase
            .from('course_enrollments')
            .select('id, courses!course_enrollments_course_id_fkey(teacher_id)')
            .eq('id', enrollmentId)
            .single();

        if (fetchError || !enrollment) {
            return res.status(404).json({ message: 'Запис не знайдено' });
        }

        const course = enrollment.courses as any;
        if (course.teacher_id !== user.id) {
            return res.status(403).json({ message: 'Ви можете видаляти тільки студентів зі своїх курсів' });
        }

        // Видалити запис
        const { error: deleteError } = await supabase
            .from('course_enrollments')
            .delete()
            .eq('id', enrollmentId);

        if (deleteError) throw deleteError;

        res.status(204).send();
    } catch (error: any) {
        console.error('Error removing student from course:', error);
        res.status(500).json({ message: error.message });
    }
});

export default router;