import { Router } from 'express';
import { supabase } from '../config/supabase';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

/**
 * GET /api/teachers/:id
 * Отримати профіль викладача
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Отримати базову інформацію про викладача
        const { data: teacher, error: teacherError } = await supabase
            .from('profiles')
            .select(`
                id,
                first_name,
                last_name,
                user_name,
                email,
                avatar_url,
                academic_rank,
                department,
                office_location,
                biography,
                credentials,
                contact_info,
                privacy_settings,
                created_at,
                updated_at
            `)
            .eq('id', id)
            .eq('role', 'teacher')
            .single();

        if (teacherError || !teacher) {
            return res.status(404).json({ message: 'Викладача не знайдено' });
        }

        // Отримати активні курси викладача
        const { data: courses, error: coursesError } = await supabase
            .from('courses')
            .select(`
                id,
                title,
                description,
                semester,
                cover_image_url,
                status,
                created_at,
                updated_at
            `)
            .eq('teacher_id', id)
            .eq('status', 'ACTIVE')
            .order('created_at', { ascending: false });

        if (coursesError) {
            console.error('Error fetching teacher courses:', coursesError);
        }

        // Перетворити дані у формат, очікуваний frontend
        const teacherProfile = {
            id: teacher.id,
            firstName: teacher.first_name,
            lastName: teacher.last_name,
            email: teacher.email,
            avatarUrl: teacher.avatar_url,
            academicRank: teacher.academic_rank,
            department: teacher.department,
            officeLocation: teacher.office_location,
            biography: teacher.biography,
            credentials: teacher.credentials,
            contactInfo: teacher.contact_info,
            privacySettings: teacher.privacy_settings,
            activeCourses: (courses || []).map(course => ({
                id: course.id,
                title: course.title,
                description: course.description,
                semester: course.semester,
                coverImageUrl: course.cover_image_url,
                isEnrolled: false, // Буде оновлено в enrollment-status endpoint
                status: course.status,
                createdAt: course.created_at,
                updatedAt: course.updated_at
            })),
            createdAt: teacher.created_at,
            updatedAt: teacher.updated_at
        };

        res.json(teacherProfile);
    } catch (error: any) {
        console.error('Error fetching teacher profile:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * GET /api/teachers/:id/enrollment-status
 * Перевірити статус зарахування поточного користувача на курси викладача
 */
router.get('/:id/enrollment-status', authenticate, async (req, res) => {
    try {
        const { id: teacherId } = req.params;
        const user = (req as AuthRequest).user;

        // Отримати курси викладача, на які записаний поточний користувач
        const { data: enrollments, error } = await supabase
            .from('course_enrollments')
            .select(`
                course_id,
                courses!course_enrollments_course_id_fkey (
                    id,
                    teacher_id
                )
            `)
            .eq('student_id', user.id)
            .eq('status', 'active');

        if (error) {
            console.error('Error checking enrollment status:', error);
            return res.status(500).json({ message: error.message });
        }

        // Фільтрувати курси цього викладача
        const teacherCourses = (enrollments || [])
            .filter(enrollment => {
                const course = enrollment.courses as any;
                return course && course.teacher_id === teacherId;
            })
            .map(enrollment => enrollment.course_id);

        const result = {
            isEnrolledInAny: teacherCourses.length > 0,
            enrolledCourses: teacherCourses
        };

        res.json(result);
    } catch (error: any) {
        console.error('Error checking enrollment status:', error);
        res.status(500).json({ message: error.message });
    }
});

/**
 * GET /api/teachers
 * Отримати список всіх викладачів (з пагінацією)
 */
router.get('/', async (req, res) => {
    try {
        const { department, page = 1, size = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(size);

        let query = supabase
            .from('profiles')
            .select(`
                id,
                first_name,
                last_name,
                user_name,
                email,
                avatar_url,
                academic_rank,
                department,
                created_at
            `, { count: 'exact' })
            .eq('role', 'teacher')
            .order('last_name', { ascending: true })
            .range(offset, offset + Number(size) - 1);

        if (department) {
            query = query.eq('department', department);
        }

        const { data: teachers, error, count } = await query;

        if (error) {
            console.error('Error fetching teachers:', error);
            return res.status(500).json({ message: error.message });
        }

        const result = {
            data: (teachers || []).map(teacher => ({
                id: teacher.id,
                firstName: teacher.first_name,
                lastName: teacher.last_name,
                department: teacher.department,
                academicRank: teacher.academic_rank,
                avatarUrl: teacher.avatar_url
            })),
            pagination: {
                page: Number(page),
                size: Number(size),
                total: count || 0,
                totalPages: Math.ceil((count || 0) / Number(size))
            }
        };

        res.json(result);
    } catch (error: any) {
        console.error('Error fetching teachers list:', error);
        res.status(500).json({ message: error.message });
    }
});

export default router;