import { Request, Response, NextFunction } from 'express';
import { supabase } from '../config/supabase';

export interface AuthRequest extends Request {
    user?: any;
}

export const authenticate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');

        if (!token) {
            return res.status(401).json({ message: 'Токен не надано' });
        }

        const { data: { user }, error } = await supabase.auth.getUser(token);

        if (error || !user) {
            return res.status(401).json({ message: 'Невірний токен' });
        }

        // Get profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

        (req as AuthRequest).user = { ...user, ...profile };
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Помилка автентифікації' });
    }
};

export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const user = (req as AuthRequest).user;

        if (!user || !roles.includes(user.role)) {
            return res.status(403).json({ message: 'Доступ заборонено' });
        }

        next();
    };
};
