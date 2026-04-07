import Redis from 'ioredis';
import { createApp } from './app';

const PORT       = process.env.PORT        || 3007;
const REDIS_URL  = process.env.REDIS_URL   || 'redis://localhost:6379';

const redis = new Redis(REDIS_URL, { lazyConnect: true });

async function main() {
  await redis.connect();
  await redis.ping(); // verify connectivity before accepting traffic

  const app = createApp(redis);
  app.listen(PORT, () => {
    console.log(`[media-service] listening on port ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    await redis.quit();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

main().catch(err => {
  console.error('[media-service] startup error', err);
  process.exit(1);
});
