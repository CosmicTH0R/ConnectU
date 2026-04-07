import express from 'express';
import Redis from 'ioredis';
import buildMediaRouter from './routes/media.routes';

export function createApp(redis: Redis) {
  const app = express();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Health probe
  app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'media-service' }));

  // Routes (mount at /media so they match the api-gateway proxy)
  app.use('/media', buildMediaRouter(redis));

  return app;
}
