import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import departmentRoutes from './routes/department.routes.js';
import complaintRoutes from './routes/complaint.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import workerRoutes from './routes/worker.routes.js';
import workersRoutes from './routes/workers.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

dotenv.config();

const app = express();

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  const staticAllowed = [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://civicflow-app.vercel.app',
    process.env.FRONTEND_URL
  ].filter(Boolean);
  if (staticAllowed.includes(origin)) return true;
  const lower = origin.toLowerCase();
  if (lower.endsWith('.vercel.app')) return true;
  if (lower.startsWith('http://localhost:') || lower.startsWith('http://127.0.0.1:')) return true;
  return staticAllowed.some(o => lower.startsWith(o.replace(/\/$/, '').toLowerCase()));
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','Origin','X-Requested-With'],
  preflightContinue: true,
  optionsSuccessStatus: 204
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, statusCode: 400, message: 'Invalid JSON body' });
  }
  next(err);
});

// Increase JSON and URL-encoded body parser limits for Base64 image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// API Base Routes
app.use('/api/v1', healthRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/departments', departmentRoutes);
app.use('/api/v1/complaints', complaintRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/workers', workersRoutes);
app.use('/api/v1/worker', workerRoutes);

// 404 Catch-All for undefined API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
});

// Global Error Handler
app.use(errorHandler);

export default app;
