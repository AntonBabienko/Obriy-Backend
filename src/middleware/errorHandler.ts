import { Request, Response, NextFunction } from 'express';

export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error('Error:', err);

    res.status(500).json({
        message: err.message || 'Внутрішня помилка сервера',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};
