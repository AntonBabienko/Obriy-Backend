import { Router } from 'express';
import { supabase } from '../config/supabase';
import { z } from 'zod';

const router = Router();

const registerSchema = z.object({
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    userName: z.string().min(3),
    email: z.string().email(),
    password: z.string().min(6),
    role: z.enum(['student', 'teacher']),
    sex: z.enum(['male', 'female', 'other']).optional().or(z.literal('').transform(() => undefined))
});

const loginSchema = z.object({
    email: z.string().email(),
    password: z.string()
});

router.post('/register', async (req, res) => {
    try {
        const data = registerSchema.parse(req.body);

        // Temporary bypass for testing - return success without Supabase
        console.log('Registration attempt:', { email: data.email, role: data.role });

        // Return mock success response
        return res.status(201).json({
            message: 'Реєстрація тимчасово недоступна (тестовий режим)',
            user: {
                id: 'test-user-id',
                email: data.email,
                role: data.role
            }
        });

        // Original Supabase code (commented out for testing)
        /*
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true
        });

        if (authError) {
            return res.status(400).json({ message: authError.message });
        }

        // Create profile
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: authData.user.id,
                first_name: data.firstName,
                last_name: data.lastName,
                user_name: data.userName,
                role: data.role,
                sex: data.sex
            });

        if (profileError) {
            return res.status(400).json({ message: profileError.message });
        }

        // Sign in to get session
        const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password
        });

        if (sessionError) {
            return res.status(400).json({ message: sessionError.message });
        }

        res.status(201).json({
            token: sessionData.session?.access_token,
            user: {
                id: authData.user.id,
                email: data.email,
                firstName: data.firstName,
                lastName: data.lastName,
                userName: data.userName,
                role: data.role
            }
        });
        */
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

router.post('/login', async (req, res) => {
    try {
        const data = loginSchema.parse(req.body);

        const { data: sessionData, error } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password
        });

        if (error) {
            return res.status(401).json({ message: 'Невірні облікові дані' });
        }

        // Get profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionData.user.id)
            .single();

        res.json({
            token: sessionData.session.access_token,
            user: {
                id: sessionData.user.id,
                email: sessionData.user.email,
                ...profile
            }
        });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
});

export default router;
