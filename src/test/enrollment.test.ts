import { describe, it, expect } from 'vitest';

describe('Enrollment API Endpoints', () => {
    const BASE_URL = 'http://localhost:3001';

    it('should verify enroll endpoint exists and requires authentication', async () => {
        const response = await fetch(`${BASE_URL}/api/enrollment/enroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ courseId: 1 })
        });

        expect(response.status).toBe(401);
        const body = await response.json() as any;
        expect(body).toHaveProperty('message');
        expect(body.message).toBe('Токен не надано');
    });

    it('should verify course students endpoint exists and requires authentication', async () => {
        const response = await fetch(`${BASE_URL}/api/enrollment/course/1/students`, {
            method: 'GET'
        });

        expect(response.status).toBe(401);
        const body = await response.json() as any;
        expect(body).toHaveProperty('message');
        expect(body.message).toBe('Токен не надано');
    });

    it('should verify user courses endpoint exists and requires authentication', async () => {
        const response = await fetch(`${BASE_URL}/api/enrollment/user/courses`, {
            method: 'GET'
        });

        expect(response.status).toBe(401);
        const body = await response.json() as any;
        expect(body).toHaveProperty('message');
        expect(body.message).toBe('Токен не надано');
    });

    it('should verify unenroll endpoint exists and requires authentication', async () => {
        const response = await fetch(`${BASE_URL}/api/enrollment/unenroll`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ courseId: 1 })
        });

        expect(response.status).toBe(401);
        const body = await response.json() as any;
        expect(body).toHaveProperty('message');
        expect(body.message).toBe('Токен не надано');
    });

    it('should verify enrollment status endpoint exists and requires authentication', async () => {
        const response = await fetch(`${BASE_URL}/api/enrollment/status/1`, {
            method: 'GET'
        });

        expect(response.status).toBe(401);
        const body = await response.json() as any;
        expect(body).toHaveProperty('message');
        expect(body.message).toBe('Токен не надано');
    });
});