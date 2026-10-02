import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { csrfProtection } from './middleware/csrf.js';
import { securityRouter } from './routes/security.js';
import { uploadsRouter } from './routes/uploads.js';
import { maintenanceRouter } from './routes/maintenance.js';
import { identify } from './middleware/auth.js';
import { errorHandler, asyncRoute, HttpError } from './utils/errors.js';
import { db } from './utils/db.js';
import { authRouter } from './routes/auth.js';
import { requestsRouter, filesRouter, tasksRouter } from './routes/requests.js';
import { appointmentsRouter } from './routes/appointments.js';
import { ordersRouter, paymentsRouter } from './routes/orders.js';
import {
  clientsRouter,
  carsRouter,
  servicesRouter,
  usersRouter,
  settingsRouter,
} from './routes/entities.js';
import {
  dashboardRouter,
  analyticsRouter,
  searchRouter,
  notificationsRouter,
} from './routes/dashboard.js';
export const app = express();
app.disable('x-powered-by');
app.set('trust proxy', process.env.TRUST_PROXY === '1' ? 1 : false);
app.use((req, res, next) => {
  req.securityRequestId = randomUUID();
  res.setHeader('X-Request-ID', req.securityRequestId);
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  next();
});
const origins = (process.env.APP_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173,http://127.0.0.1:5173')).split(',').map((value) => value.trim()).filter(Boolean);
// Platform-provided hosts permit the current deployment without trusting the request Host header.
if (process.env.VERCEL) {
  for (const host of [process.env.VERCEL_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (host && /^[a-z0-9.-]+$/i.test(host)) origins.push(`https://${host}`);
  }
}
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    origin: (origin, cb) =>
      !origin || origins.includes(origin)
        ? cb(null, true)
        : cb(new HttpError(403, 'Недопустимый источник запроса.')),
    credentials: true,
  }),
);
app.use((req, _res, next) => {
  const origin = req.get('origin');
  let refererOrigin: string | undefined;
  try { if (req.get('referer')) refererOrigin = new URL(req.get('referer')!).origin; } catch { refererOrigin = 'invalid'; }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && ((origin && !origins.includes(origin)) || (!origin && refererOrigin && !origins.includes(refererOrigin)) || req.get('sec-fetch-site') === 'cross-site')) {
    next(new HttpError(403, 'Недопустимый источник запроса.'));
    return;
  }
  next();
});
app.use(express.json({ limit: '256kb' }), cookieParser());
app.get(
  '/api/health',
  asyncRoute(async (_req, res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'PostgreSQL' });
  }),
);
app.use('/api', identify);
app.use('/api', csrfProtection);
app.use('/api/auth', authRouter);
app.use('/api/security', securityRouter);
app.use('/api/uploads', uploadsRouter);
app.use('/api/internal', maintenanceRouter);
app.use('/api/requests', requestsRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/cars', carsRouter);
app.use('/api/appointments', appointmentsRouter);
app.use('/api/work-orders', ordersRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/users', usersRouter);
app.use('/api/services', servicesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/files', filesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/search', searchRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', (_req, res) => res.status(404).json({ message: 'Метод API не найден.' }));
if (existsSync(path.resolve('dist/index.html'))) {
  app.use(express.static(path.resolve('dist')));
  app.get('*', (_req, res) => res.sendFile(path.resolve('dist/index.html')));
}
app.use(errorHandler);
