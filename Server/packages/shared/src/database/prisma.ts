import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

declare global {
  // Allow global var in development to prevent multiple instances with hot reload
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

export function getPrismaClient(): PrismaClient {
  if (process.env.NODE_ENV === 'production') {
    return createPrismaClient();
  }

  // In development, reuse the same instance across hot reloads
  if (!global.__prisma) {
    global.__prisma = createPrismaClient();
  }
  return global.__prisma;
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['warn', 'error'],
    errorFormat: 'minimal',
  });

  // Graceful shutdown hook
  ['SIGINT', 'SIGTERM'].forEach((signal) => {
    process.once(signal, async () => {
      logger.info('Disconnecting Prisma client...');
      await client.$disconnect();
    });
  });

  return client;
}

export async function connectPrisma(client: PrismaClient): Promise<void> {
  await client.$connect();
  logger.info('PostgreSQL (Prisma) connected');
}
