import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { getRedisClient } from '@instagram/shared';
import { requestIdMiddleware, requestLoggerMiddleware } from '@instagram/shared';
import { FeedService } from './services/feed.service';
import { buildFeedRoutes } from './routes/feed.routes';

export function createApp() {
  const redis = getRedisClient();
  const feedService = new FeedService(redis);

  const app = express();

  // ─── Security & parsing ─────────────────────────────────────────────────────
  app.use(helmet());
  app.use(cors({
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:3000').split(','),
    credentials: true,
  }));
  app.use(express.json({ limit: '256kb' }));
  app.use(requestIdMiddleware);
  app.use(requestLoggerMiddleware);

  // ─── Health ─────────────────────────────────────────────────────────────────
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'feed-service', timestamp: new Date().toISOString() });
  });

  // ─── Routes ─────────────────────────────────────────────────────────────────
  app.use('/feed', buildFeedRoutes(feedService));

  // ─── 404 ────────────────────────────────────────────────────────────────────
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // ─── Error handler ───────────────────────────────────────────────────────────
  app.use((err: Error & { status?: number }, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status ?? 500;
    const message = status < 500 ? err.message : 'Internal server error';
    if (status >= 500) console.error('[feed-service]', err);
    res.status(status).json({ success: false, error: message });
  });

  return { app, feedService };
}
