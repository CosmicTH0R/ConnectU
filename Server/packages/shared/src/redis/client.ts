import Redis, { RedisOptions } from 'ioredis';
import { logger } from '../utils/logger';

export type RedisClient = Redis;

let redisInstance: Redis | null = null;

export function getRedisClient(): Redis {
  if (!redisInstance) {
    // Prefer REDIS_URL (e.g. Upstash rediss:// URI) over individual host/port vars
    const redisUrl = process.env.REDIS_URL;

    const baseOptions: RedisOptions = {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 50, 2_000),
    };

    if (redisUrl) {
      redisInstance = new Redis(redisUrl, baseOptions);
    } else {
      redisInstance = new Redis({
        ...baseOptions,
        host: process.env.REDIS_HOST ?? 'localhost',
        port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
        password: process.env.REDIS_PASSWORD,
      });
    }

    redisInstance.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisInstance.on('error', (err: Error) => {
      logger.error('Redis client error', { err: err.message });
    });

    redisInstance.on('close', () => {
      logger.warn('Redis client connection closed');
    });
  }

  return redisInstance;
}

export async function closeRedisClient(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
  }
}

// ─── Typed Redis helpers ───────────────────────────────────────────────────────

export async function setWithTTL(
  redis: Redis,
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
}

export async function getJSON<T>(redis: Redis, key: string): Promise<T | null> {
  const raw = await redis.get(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

export async function deleteKeys(redis: Redis, ...keys: string[]): Promise<void> {
  if (keys.length === 0) return;
  await redis.del(...keys);
}
