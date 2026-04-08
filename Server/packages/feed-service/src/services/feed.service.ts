import axios from 'axios';
import type { Redis } from 'ioredis';
import {
  FEED_MAX_SIZE,
  CELEBRITY_FOLLOWER_THRESHOLD,
  REDIS_KEYS,
} from '@instagram/shared';

// ─── Redis key helpers ────────────────────────────────────────────────────────

const CELEB_POSTS_KEY   = (authorId: string) => `celeb_posts:${authorId}`;
const CELEB_FOLLOWING_KEY = (userId: string) => `celeb_following:${userId}`;
const FOLLOWERS_KEY     = (userId: string)   => `followers:${userId}`;
const FOLLOWING_KEY     = (userId: string)   => `following:${userId}`;
const EXPLORE_KEY       = 'explore_posts';
const DELETED_POSTS_KEY = 'deleted_posts';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedPost {
  postId: string;
  authorId: string;
  mediaType: 'image' | 'video';
  caption?: string;
  mediaUrls: string[];
  likeCount: number;
  commentCount: number;
  saveCount: number;
  createdAt: string;
  score?: number;
  isLiked?: boolean;
  isSaved?: boolean;
}

export interface FeedPage {
  posts: FeedPost[];
  nextCursor: string | null;
}

// ─── Engagement ranking ───────────────────────────────────────────────────────

function engagementScore(post: {
  likeCount: number;
  commentCount: number;
  saveCount: number;
  createdAt: string | Date;
}): number {
  const ageMs = Date.now() - new Date(post.createdAt).getTime();
  const ageHours = ageMs / (1000 * 60 * 60);
  const raw = post.likeCount + post.commentCount * 2 + post.saveCount * 3;
  return raw / Math.log(ageHours + 1 + 1); // +1 to avoid log(0) / log(1)=0
}

// ─── FeedService ─────────────────────────────────────────────────────────────

export class FeedService {
  private readonly postServiceUrl: string;

  constructor(private readonly redis: Redis) {
    this.postServiceUrl =
      process.env.POST_SERVICE_URL ?? 'http://localhost:3002';
  }

  // ── Fan-out helpers ─────────────────────────────────────────────────────────

  /** Returns true when an author's follower count exceeds the celebrity threshold */
  private async isCelebrity(authorId: string): Promise<boolean> {
    const count = await this.redis.scard(FOLLOWERS_KEY(authorId));
    return count > CELEBRITY_FOLLOWER_THRESHOLD;
  }

  /** Push a post into every non-celebrity follower's feed */
  async fanOutPost(postId: string, authorId: string, createdAtMs: number): Promise<void> {
    const celebrity = await this.isCelebrity(authorId);

    if (celebrity) {
      // Celebrity path: store post in author's own sorted set
      await this.redis.zadd(CELEB_POSTS_KEY(authorId), createdAtMs, postId);
      await this.redis.zremrangebyrank(CELEB_POSTS_KEY(authorId), 0, -(FEED_MAX_SIZE + 1));
    } else {
      // Non-celebrity: push post to every follower's feed
      const followers = await this.redis.smembers(FOLLOWERS_KEY(authorId));
      if (followers.length === 0) return;

      const pipeline = this.redis.pipeline();
      for (const followerId of followers) {
        pipeline.zadd(REDIS_KEYS.userFeed(followerId), createdAtMs, postId);
        pipeline.zremrangebyrank(REDIS_KEYS.userFeed(followerId), 0, -(FEED_MAX_SIZE + 1));
      }
      await pipeline.exec();
    }

    // Also add to global explore sorted set (for all posts)
    await this.redis.zadd(EXPLORE_KEY, createdAtMs, postId);
    await this.redis.zremrangebyrank(EXPLORE_KEY, 0, -(FEED_MAX_SIZE * 10 + 1));
  }

  /** Remove a deleted post from all relevant feeds */
  async removePost(postId: string, authorId: string): Promise<void> {
    // Mark as deleted (used as a filter for celebrity feeds)
    await this.redis.sadd(DELETED_POSTS_KEY, postId);
    // Expire the deleted set entry after 7 days so it doesn't grow forever
    // (use a per-post key with TTL since SADD doesn't support per-member TTL)
    await this.redis.set(`deleted:${postId}`, '1', 'EX', 7 * 24 * 3600);

    const celebrity = await this.isCelebrity(authorId);
    if (celebrity) {
      await this.redis.zrem(CELEB_POSTS_KEY(authorId), postId);
    } else {
      // Remove from each follower's feed
      const followers = await this.redis.smembers(FOLLOWERS_KEY(authorId));
      if (followers.length > 0) {
        const pipeline = this.redis.pipeline();
        for (const followerId of followers) {
          pipeline.zrem(REDIS_KEYS.userFeed(followerId), postId);
        }
        await pipeline.exec();
      }
    }

    // Remove from explore feed
    await this.redis.zrem(EXPLORE_KEY, postId);
  }

  // ── Follow relationship tracking ────────────────────────────────────────────

  async recordFollow(followerId: string, followingId: string): Promise<void> {
    await Promise.all([
      this.redis.sadd(FOLLOWERS_KEY(followingId), followerId),
      this.redis.sadd(FOLLOWING_KEY(followerId), followingId),
    ]);

    // If newly followed user is a celebrity, track for hybrid merge
    const celebrity = await this.isCelebrity(followingId);
    if (celebrity) {
      await this.redis.sadd(CELEB_FOLLOWING_KEY(followerId), followingId);
    }
  }

  async recordUnfollow(followerId: string, followingId: string): Promise<void> {
    await Promise.all([
      this.redis.srem(FOLLOWERS_KEY(followingId), followerId),
      this.redis.srem(FOLLOWING_KEY(followerId), followingId),
      this.redis.srem(CELEB_FOLLOWING_KEY(followerId), followingId),
    ]);

    // Remove unfollowed user's posts from follower's feed
    const celebrity = await this.isCelebrity(followingId);
    if (!celebrity) {
      // Scan feed for this follower and remove posts by unfollowed user
      // (impractical without storing authorId in member. Skip: next rebuild will fix it.)
    }
  }

  // ── Feed reading ────────────────────────────────────────────────────────────

  /**
   * Read the home feed for a user.
   * Merges pre-computed non-celebrity entries with on-read celebrity posts.
   * Uses cursor-based pagination (cursor = score/timestamp).
   */
  async getFeed(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<FeedPage> {
    const maxScore = cursor ? parseFloat(cursor) - 1 : '+inf';
    const minScore = '-inf';

    // Non-celebrity posts from user's pre-computed feed
    const regularIds = await this.redis.zrevrangebyscore(
      REDIS_KEYS.userFeed(userId),
      maxScore,
      minScore,
      'LIMIT',
      0,
      limit * 2, // fetch extra to account for deleted and celebrity overlap
    );

    // Celebrity posts: merge from all followed celebrities
    const celebIds = await this.getCelebPostIds(userId, maxScore, minScore, limit);

    // Merge + de-dup
    const allIds = dedup([...regularIds, ...celebIds]);

    // Filter deleted posts
    const liveIds = await this.filterDeleted(allIds);

    // Sort by recency (score descending) — we need scores for sorting
    const withScores = await this.getWithScores(userId, liveIds);
    withScores.sort((a, b) => b.score - a.score);

    const pageIds = withScores.slice(0, limit);

    // Hydrate from post-service
    const posts = await this.hydratePosts(pageIds.map((p) => p.id));

    // Rank within page
    const ranked = posts
      .map((p) => ({ ...p, score: engagementScore(p) }))
      .sort((a, b) => b.score - a.score);

    const nextCursor =
      pageIds.length === limit
        ? String(pageIds[pageIds.length - 1].score)
        : null;

    return { posts: ranked, nextCursor };
  }

  /**
   * Explore feed: recent posts from non-followed users (globally popular).
   */
  async getExploreFeed(
    userId: string,
    cursor: string | null,
    limit: number,
  ): Promise<FeedPage> {
    const maxScore = cursor ? parseFloat(cursor) - 1 : '+inf';

    const allExploreIds = await this.redis.zrevrangebyscore(
      EXPLORE_KEY,
      maxScore,
      '-inf',
      'LIMIT',
      0,
      limit * 4,
    );

    // Exclude posts from users the current user follows
    const following = await this.redis.smembers(FOLLOWING_KEY(userId));
    const followingSet = new Set(following);

    // Get post authors to filter (requires hydration — batch fetch)
    const liveIds = await this.filterDeleted(allExploreIds);

    // Hydrate to find authors; filter by non-followed
    const rawPosts = await this.hydratePosts(liveIds.slice(0, limit * 3));
    const filtered = rawPosts.filter((p) => !followingSet.has(p.authorId));

    const page = filtered.slice(0, limit);
    const ranked = page
      .map((p) => ({ ...p, score: engagementScore(p) }))
      .sort((a, b) => b.score - a.score);

    const nextCursor =
      filtered.length > limit
        ? String(ranked[ranked.length - 1].score)
        : null;

    return { posts: ranked, nextCursor };
  }

  /**
   * Force-rebuild a user's feed from scratch:
   * Fetches following list + their recent posts from post-service and writes to Redis.
   */
  async rebuildFeed(userId: string): Promise<{ rebuilt: number }> {
    // Get the users this user follows (from Redis following set)
    const following = await this.redis.smembers(FOLLOWING_KEY(userId));
    if (following.length === 0) {
      return { rebuilt: 0 };
    }

    // Fetch recent posts from each followed non-celebrity user (parallel, max 20 users)
    const nonCelebs = await Promise.all(
      following.map(async (authorId) => {
        const isC = await this.isCelebrity(authorId);
        return isC ? null : authorId;
      }),
    ).then((arr) => arr.filter(Boolean) as string[]);

    const postBatches = await Promise.allSettled(
      nonCelebs.slice(0, 50).map((authorId) =>
        this.fetchUserPosts(authorId, 20),
      ),
    );

    // Delete existing feed and rebuild
    await this.redis.del(REDIS_KEYS.userFeed(userId));

    const pipeline = this.redis.pipeline();
    let rebuilt = 0;

    for (const result of postBatches) {
      if (result.status === 'fulfilled') {
        for (const post of result.value) {
          const score = new Date(post.createdAt).getTime();
          pipeline.zadd(REDIS_KEYS.userFeed(userId), score, post.postId);
          rebuilt++;
        }
      }
    }

    pipeline.zremrangebyrank(REDIS_KEYS.userFeed(userId), 0, -(FEED_MAX_SIZE + 1));
    await pipeline.exec();

    return { rebuilt };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getCelebPostIds(
    userId: string,
    maxScore: string | number,
    minScore: string | number,
    limit: number,
  ): Promise<string[]> {
    const celebs = await this.redis.smembers(CELEB_FOLLOWING_KEY(userId));
    if (celebs.length === 0) return [];

    const results = await Promise.all(
      celebs.map((celebId) =>
        this.redis.zrevrangebyscore(
          CELEB_POSTS_KEY(celebId),
          maxScore,
          minScore,
          'LIMIT',
          0,
          limit,
        ),
      ),
    );

    return results.flat();
  }

  private async filterDeleted(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.exists(`deleted:${id}`);
    }
    const results = await pipeline.exec();
    return ids.filter((_, i) => {
      const result = results?.[i];
      return result && result[1] === 0;
    });
  }

  private async getWithScores(
    userId: string,
    ids: string[],
  ): Promise<Array<{ id: string; score: number }>> {
    if (ids.length === 0) return [];
    const pipeline = this.redis.pipeline();
    for (const id of ids) {
      pipeline.zscore(REDIS_KEYS.userFeed(userId), id);
    }
    const results = await pipeline.exec();

    return ids.map((id, i) => {
      const scoreStr = results?.[i]?.[1] as string | null;
      const score = scoreStr ? parseFloat(scoreStr) : 0;
      return { id, score };
    });
  }

  private async hydratePosts(postIds: string[]): Promise<FeedPost[]> {
    if (postIds.length === 0) return [];

    const results = await Promise.allSettled(
      postIds.map((id) =>
        axios.get<{ data: FeedPost }>(`${this.postServiceUrl}/posts/${id}`, {
          timeout: 3000,
        }),
      ),
    );

    return results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => (r as PromiseFulfilledResult<{ data: { data: FeedPost } }>).value.data.data)
      .filter(Boolean);
  }

  private async fetchUserPosts(
    authorId: string,
    limit: number,
  ): Promise<Array<{ postId: string; createdAt: string }>> {
    const resp = await axios.get<{
      data: Array<{ id: string; createdAt: string }>;
    }>(`${this.postServiceUrl}/users/${authorId}/posts?limit=${limit}`, {
      timeout: 3000,
    });
    return (resp.data.data ?? []).map((p) => ({
      postId: p.id,
      createdAt: p.createdAt,
    }));
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function dedup(ids: string[]): string[] {
  return [...new Set(ids)];
}
