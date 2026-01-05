import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

export interface SupabaseAuthRequest extends Request {
    user?: any;
    supabaseUser?: any;
}

/**
 * Middleware для автентифікації через Supabase Auth
 * Цей підхід правильно працює з RLS політиками
 */
export const supabaseAuthenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Токен не надано' });
        }

        // Встановлюємо токен для поточного запиту
        // Це дозволить RLS політикам правильно працювати з auth.uid()
        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ message: 'Невірний токен' });
        }

        // Створюємо новий клієнт з токеном користувача для цього запиту
        const userSupabase = supabase.auth.setSession({
            access_token: token,
            refresh_token: '' // Не потрібен для service operations
        });

        // Отримуємо профіль користувача
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        if (profileError) {
            console.warn('[Auth] Profile not found for user:', user.id);
        }

        // Додаємо користувача до запиту
        (req as SupabaseAuthRequest).user = { ...user, ...profile };
        (req as SupabaseAuthRequest).supabaseUser = user;

        next();
    } catch (error: any) {
        console.error('[Auth] Authentication error:', error);
        return res.status(401).json({ message: 'Помилка автентифікації' });
    }
};

/**
 * Middleware для авторизації ролей
 */
export const supabaseAuthorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as SupabaseAuthRequest).user;

        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: 'Доступ заборонено' });
        }

        next();
    };
};

/**
 * Створює Supabase клієнт з токеном користувача
 * Це дозволяє RLS політикам правильно працювати
 */
export const createUserSupabaseClient = (token: string) => {
    return supabase.auth.setSession({
        access_token: token,
        refresh_token: ''
    });
};

/**
 * Middleware для операцій, які потребують service role
 * Використовує service key для обходу RLS
 */
export const requireServiceRole = (req: Request, res: Response, next: NextFunction) => {
    // Цей middleware дозволяє операції тільки з service key
    // Перевіряємо, чи запит йде з правильними правами
    const authHeader = req.headers.authorization;
    const serviceKey = process.env.SUPABASE_SERVICE_KEY;

    if (!authHeader || !authHeader.includes(serviceKey!)) {
        return res.status(403).json({ message: 'Service role required' });
    }

    next();
};