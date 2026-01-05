import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

// Get current user profile
router.get('/me', authenticate, (req, res) => {
    const user = (req as AuthRequest).user;
    res.json(user);
});

// Update user profile
router.put('/me', authenticate, (req, res) => {
    const user = (req as AuthRequest).user;

    // Mock update
    const updatedUser = {
        ...user,
        ...req.body,
        id: user?.id, // Don't allow ID change
        role: user?.role // Don't allow role change
    };

    res.json(updatedUser);
});

export default router;
