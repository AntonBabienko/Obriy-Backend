import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import authRoutes from './routes/auth.routes';
import courseRoutes from './routes/course.routes';
import lectureRoutes from './routes/lecture.routes';
import testRoutes from './routes/test.routes';
import aiRoutes from './routes/ai.routes';
import groupRoutes from './routes/group.routes';
import statsRoutes from './routes/stats.routes';
import cacheRoutes from './routes/cache.routes';
import enrollmentRoutes from './routes/enrollment.routes';
import teacherRoutes from './routes/teacher.routes';
import aiHistoryRoutes from './routes/ai-history.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configure multer for file uploads
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// Middleware - CORS configured for production
const allowedOrigins = [
    'https://obriy-frontend-6h3m.vercel.app',
    'http://localhost:5173',
    'http://localhost:3000'
];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Routes
app.use('/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/tests', testRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/ai-history', aiHistoryRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Memory stats endpoint
app.get('/memory', (req, res) => {
    const mem = process.memoryUsage();
    res.json({
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`,
        external: `${(mem.external / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
        timestamp: new Date().toISOString()
    });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📚 Obriy Backend with Supabase + AI`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});
