import { Request } from 'express';

export interface User {
    id: number;
    firstName: string;
    lastName: string;
    userName: string;
    email: string;
    role: 'ROLE_USER' | 'ROLE_LECTURER';
    sex: 'MALE' | 'FEMALE' | 'OTHER';
    createdAt: Date;
}

export interface Course {
    id: number;
    title: string;
    description: string;
    teacherId: number;
    createdAt: Date;
}

export interface AuthRequest extends Request {
    user?: User;
}
