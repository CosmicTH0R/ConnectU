import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { requestIdMiddleware } from './middleware/request-id.middleware';
import { proxyRoutes } from './routes/proxy.routes';
import {
  requestLoggerMiddleware,
  errorHandler,
  logger,
} from '@instagram/shared';

const app = express();

// ─── Security ─────────────────────────────────────────────────────────────────
app.use(helmet());
app.set('trust proxy', 1);

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-request-id'],
    exposedHeaders: ['x-request-id', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset'],
  }),
);

// ─── Request tracing ──────────────────────────────────────────────────────────
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);

// ─── Body parsing (for non-proxied routes like /health) ──────────────────────
app.use(express.json({ limit: '100kb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'api-gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
});

// ─── Proxy routes ─────────────────────────────────────────────────────────────
app.use('/', proxyRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start server ─────────────────────────────────────────────────────────────
const server = app.listen(config.port, () => {
  logger.info('API Gateway started', {
    port: config.port,
    env: config.nodeEnv,
    services: Object.keys(config.services),
  });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = (signal: string) => {
  logger.info(`API Gateway received ${signal}, shutting down...`);
  server.close(() => {
    logger.info('API Gateway stopped');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
