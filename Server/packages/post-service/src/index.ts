import 'dotenv/config';
import { app } from './app';
import { prisma } from './db';

const PORT = parseInt(process.env.PORT ?? '3002', 10);

async function main(): Promise<void> {
  await prisma.$connect();
  console.log('[post-service] PostgreSQL connected');

  const server = app.listen(PORT, () => {
    console.log(`[post-service] Listening on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[post-service] ${signal} received — shutting down…`);
    server.close(async () => {
      await prisma.$disconnect();
      console.log('[post-service] Shutdown complete');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT',  () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[post-service] Fatal startup error:', err);
  process.exit(1);
});
