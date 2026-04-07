import type { Redis } from 'ioredis';

const ONLINE_TTL = 30;       // seconds — auto-offline if no heartbeat
const PRESENCE_PREFIX = 'presence:';

export class PresenceService {
  constructor(private readonly redis: Redis) {}

  async heartbeat(userId: string): Promise<void> {
    const key = `${PRESENCE_PREFIX}${userId}`;
    await this.redis.set(
      key,
      JSON.stringify({ isOnline: true, lastSeen: new Date().toISOString() }),
      'EX',
      ONLINE_TTL,
    );
  }

  async getPresence(userId: string): Promise<{ isOnline: boolean; lastSeen: string | null }> {
    const key = `${PRESENCE_PREFIX}${userId}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      // Fetch last seen from a persistent record if available
      const lastSeenKey = `presence:lastseen:${userId}`;
      const lastSeen = await this.redis.get(lastSeenKey);
      return { isOnline: false, lastSeen };
    }
    return JSON.parse(raw) as { isOnline: boolean; lastSeen: string };
  }

  async setOffline(userId: string): Promise<void> {
    const key = `${PRESENCE_PREFIX}${userId}`;
    const lastSeenKey = `presence:lastseen:${userId}`;
    const now = new Date().toISOString();
    // Persist last seen for 30 days
    await this.redis.set(lastSeenKey, now, 'EX', 30 * 24 * 60 * 60);
    await this.redis.del(key);
  }
}
