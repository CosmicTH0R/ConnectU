import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Kafka } from 'kafkajs';
import { requestIdMiddleware, requestLoggerMiddleware } from '@instagram/shared';
import { buildStoryRoutes } from './routes/story.routes';
import { buildHighlightRoutes, buildUserRoutes } from './routes/highlight.routes';

export function createApp(kafka: Kafka) {
  const app = express();

  // ─── Security & parsing ─────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // ─── Health ─────────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'story-service', timestamp: new Date().toISOString() });
  });

  // ─── Routes ─────────────────────────────────────────────────────────────────
  app.use('/stories',    buildStoryRoutes(kafka));
  app.use('/highlights', buildHighlightRoutes());
  app.use('/users',      buildUserRoutes(kafka));

  // ─── 404 ────────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // ─── Error handler ───────────────────────────────────────────────────────────
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? 500;
    const message = status < 500 ? err.message : 'Internal server error';
    if (status >= 500) console.error('[story-service]', err);
    res.status(status).json({ success: false, error: message });
  });

  return app;
}
