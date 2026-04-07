import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { requestIdMiddleware, requestLoggerMiddleware } from '@instagram/shared';
import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';

export const app = express();

// ─── Security & parsing ────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  }),
);
app.use(express.json({ limit: '1mb' }));
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// ─── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', service: 'user-service', timestamp: new Date().toISOString() });
});

// ─── Routes ────────────────────────────────────────────────────────────────────
app.use('/auth',  authRoutes);
app.use('/users', userRoutes);

// ─── 404 ───────────────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Not found' });
});

// ─── Error handler ─────────────────────────────────────────────────────────────
app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500;
  const message = status < 500 ? err.message : 'Internal server error';
  if (status >= 500) {
    console.error('[user-service] Unhandled error:', err);
  }
  res.status(status).json({ success: false, error: message });
});
