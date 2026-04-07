import 'dotenv/config';
import { app } from './app';
import { prisma } from './db';
import { getRedisClient } from '@instagram/shared';

const PORT = parseInt(process.env.PORT ?? '3001', 10);

async function main(): Promise<void> {
  // Verify DB connections on startup
  await prisma.$connect();
  console.log('[user-service] PostgreSQL connected');

  const redis = getRedisClient();
  await redis.ping();
  console.log('[user-service] Redis connected');

  const server = app.listen(PORT, () => {
    console.log(`[user-service] Listening on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[user-service] ${signal} received — shutting down…`);
    server.close(async () => {
      await prisma.$disconnect();
      await redis.quit();
      console.log('[user-service] Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[user-service] Fatal startup error:', err);
  process.exit(1);
});
