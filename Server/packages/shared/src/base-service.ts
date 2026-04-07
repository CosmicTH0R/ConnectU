import express, { Application, Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { Server } from 'http';
import { logger } from './utils/logger';
import { requestIdMiddleware, requestLoggerMiddleware } from './middleware/logger.middleware';
import { errorHandler } from './middleware/error.middleware';

export interface ServiceConfig {
  name: string;
  port: number;
  version?: string;
}

export abstract class BaseService {
  protected readonly app: Application;
  private server?: Server;

  constructor(protected readonly config: ServiceConfig) {
    this.app = express();
    this.setupCommonMiddleware();
  }

  private setupCommonMiddleware(): void {
    // Security
    this.app.use(helmet());

    // CORS
    const allowedOrigins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
    this.app.use(
      cors({
        origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
        credentials: true,
      }),
    );

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request ID + logging
    this.app.use(requestIdMiddleware);
    this.app.use(requestLoggerMiddleware);

    // Health check (before auth)
    this.app.get('/health', (_req, res) => {
      res.json({
        status: 'ok',
        service: this.config.name,
        version: this.config.version ?? '1.0.0',
        timestamp: new Date().toISOString(),
      });
    });
  }

  protected registerRoutes(prefix: string, router: Router): void {
    this.app.use(prefix, router);
  }

  protected setupErrorHandler(): void {
    this.app.use(errorHandler);
  }

  async start(): Promise<void> {
    this.setupErrorHandler();

    await this.onStart();

    this.server = this.app.listen(this.config.port, () => {
      logger.info(`${this.config.name} started`, {
        port: this.config.port,
        env: process.env.NODE_ENV,
      });
    });

    this.registerShutdownHooks();
  }

  protected abstract onStart(): Promise<void>;

  protected async onStop(): Promise<void> {
    // Override in subclasses to close DB connections, consumers, etc.
  }

  private registerShutdownHooks(): void {
    const shutdown = async (signal: string): Promise<void> => {
      logger.info(`${this.config.name} received ${signal}, shutting down...`);

      await new Promise<void>((resolve, reject) => {
        this.server?.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await this.onStop();
      logger.info(`${this.config.name} stopped`);
      process.exit(0);
    };

    process.on('SIGTERM', () => { void shutdown('SIGTERM'); });
    process.on('SIGINT', () => { void shutdown('SIGINT'); });

    process.on('unhandledRejection', (reason: unknown) => {
      logger.error('Unhandled promise rejection', { reason });
      void shutdown('unhandledRejection');
    });
  }
}
