import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { KafkaProducer, KAFKA_TOPICS } from '@instagram/shared';
import type { PostCreatedEvent, PostDeletedEvent, MentionEvent } from '@instagram/shared';
import type { CreatePostInput, UpdatePostInput, PaginationInput, HashtagQueryInput } from '../validators/post.validator';

// ─── Mention extraction ───────────────────────────────────────────────────────

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_.]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

function extractHashtags(text: string): string[] {
  const matches = text.match(/#([a-zA-Z0-9_]+)/g) ?? [];
  return [...new Set(matches.map((h) => h.slice(1).toLowerCase()))];
}

// ─── PostService ─────────────────────────────────────────────────────────────

export class PostService {
  private producer: KafkaProducer;

  constructor() {
    const kafka = new Kafka({
      clientId: 'post-service',
      brokers: (process.env.KAFKA_BROKERS ?? 'localhost:9092').split(','),
      ...(process.env.KAFKA_USE_SASL === 'true'
        ? {
            ssl: true,
            sasl: {
              mechanism: 'scram-sha-256',
              username: process.env.KAFKA_SASL_USERNAME ?? '',
              password: process.env.KAFKA_SASL_PASSWORD ?? '',
            },
          }
        : {}),
    });
    this.producer = new KafkaProducer(kafka);
  }

  // ─── Create Post ───────────────────────────────────────────────────────────

  async createPost(userId: string, input: CreatePostInput) {
    const hashtags = extractHashtags(input.caption ?? '');
    const mentionUsernames = extractMentions(input.caption ?? '');

    // Upsert hashtags and get their IDs
    const hashtagRecords: { id: string }[] = [];
    for (const name of hashtags) {
      const tag = await prisma.hashtag.upsert({
        where: { name },
        create: { id: uuidv4(), name, postCount: 1 },
        update: { postCount: { increment: 1 } },
        select: { id: true },
      });
      hashtagRecords.push(tag);
    }

    const post = await prisma.post.create({
      data: {
        id: uuidv4(),
        userId,
        caption: input.caption,
        mediaUrls: input.mediaUrls,
        mediaType: input.mediaType,
        location: input.location,
        hashtags: {
          create: hashtagRecords.map((h) => ({
            hashtagId: h.id,
          })),
        },
      },
      include: {
        hashtags: { include: { hashtag: true } },
      },
    });

    // Resolve mention usernames to user IDs via user-service HTTP (best-effort)
    if (mentionUsernames.length > 0) {
      this._resolveMentionsAndPublish(userId, post.id, mentionUsernames, null).catch(() => {
        // non-fatal
      });
    }

    const event: PostCreatedEvent = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0',
      topic: 'post.created',
      payload: {
        postId: post.id,
        userId,
        mediaType: input.mediaType,
        hashtags,
        caption: input.caption,
      },
    };
    await this.producer.publish(KAFKA_TOPICS.POST_CREATED, event).catch(() => {});

    return this._formatPost(post);
  }

  // ─── Get Post ─────────────────────────────────────────────────────────────

  async getPost(postId: string) {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      include: { hashtags: { include: { hashtag: true } } },
    });
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });
    return this._formatPost(post);
  }

  // ─── Update Post ──────────────────────────────────────────────────────────

  async updatePost(postId: string, userId: string, input: UpdatePostInput) {
    const existing = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true, caption: true } });
    if (!existing) throw Object.assign(new Error('Post not found'), { status: 404 });
    if (existing.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    // If caption changed, update hashtags
    if (input.caption !== undefined && input.caption !== existing.caption) {
      const newHashtags = extractHashtags(input.caption);

      // Remove old hashtag associations
      await prisma.postHashtag.deleteMany({ where: { postId } });

      // Upsert new hashtags
      const hashtagRecords: { id: string }[] = [];
      for (const name of newHashtags) {
        const tag = await prisma.hashtag.upsert({
          where: { name },
          create: { id: uuidv4(), name, postCount: 1 },
          update: { postCount: { increment: 1 } },
          select: { id: true },
        });
        hashtagRecords.push(tag);
      }

      await prisma.postHashtag.createMany({
        data: hashtagRecords.map((h) => ({ postId, hashtagId: h.id })),
        skipDuplicates: true,
      });
    }

    const post = await prisma.post.update({
      where: { id: postId },
      data: {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
      },
      include: { hashtags: { include: { hashtag: true } } },
    });
    return this._formatPost(post);
  }

  // ─── Delete Post ──────────────────────────────────────────────────────────

  async deletePost(postId: string, userId: string): Promise<void> {
    const existing = await prisma.post.findUnique({ where: { id: postId }, select: { userId: true } });
    if (!existing) throw Object.assign(new Error('Post not found'), { status: 404 });
    if (existing.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    await prisma.post.delete({ where: { id: postId } });

    const event: PostDeletedEvent = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0',
      topic: 'post.deleted',
      payload: { postId, userId },
    };
    await this.producer.publish(KAFKA_TOPICS.POST_DELETED, event).catch(() => {});
  }

  // ─── Get user posts ───────────────────────────────────────────────────────

  async getUserPosts(targetUserId: string, pagination: PaginationInput) {
    const { cursor, limit } = pagination;
    const posts = await prisma.post.findMany({
      where: {
        userId: targetUserId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: { hashtags: { include: { hashtag: true } } },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;

    return {
      items: items.map((p) => this._formatPost(p)),
      nextCursor,
      hasMore,
    };
  }

  // ─── Get posts by hashtag ─────────────────────────────────────────────────

  async getPostsByHashtag(query: HashtagQueryInput) {
    const { hashtag, cursor, limit } = query;
    if (!hashtag) throw Object.assign(new Error('hashtag query parameter is required'), { status: 400 });

    const tag = await prisma.hashtag.findUnique({ where: { name: hashtag.toLowerCase() }, select: { id: true } });
    if (!tag) return { items: [], nextCursor: null, hasMore: false };

    const postHashtags = await prisma.postHashtag.findMany({
      where: {
        hashtagId: tag.id,
        ...(cursor
          ? {
              post: { createdAt: { lt: new Date(cursor) } },
            }
          : {}),
      },
      orderBy: { post: { createdAt: 'desc' } },
      take: limit + 1,
      include: {
        post: { include: { hashtags: { include: { hashtag: true } } } },
      },
    });

    const hasMore = postHashtags.length > limit;
    const items = hasMore ? postHashtags.slice(0, limit) : postHashtags;
    const nextCursor = hasMore ? items[items.length - 1]!.post.createdAt.toISOString() : null;

    return {
      items: items.map((ph) => this._formatPost(ph.post)),
      nextCursor,
      hasMore,
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private _formatPost(post: {
    id: string;
    userId: string;
    caption: string | null;
    mediaUrls: string[];
    mediaType: string;
    location: string | null;
    likeCount: number;
    commentCount: number;
    saveCount: number;
    createdAt: Date;
    updatedAt: Date;
    hashtags: { hashtag: { name: string } }[];
  }) {
    return {
      id: post.id,
      userId: post.userId,
      caption: post.caption,
      mediaUrls: post.mediaUrls,
      mediaType: post.mediaType,
      location: post.location,
      likeCount: post.likeCount,
      commentCount: post.commentCount,
      saveCount: post.saveCount,
      hashtags: post.hashtags.map((ph) => ph.hashtag.name),
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };
  }

  private async _resolveMentionsAndPublish(
    actorId: string,
    postId: string,
    usernames: string[],
    commentId: string | null,
  ): Promise<void> {
    const userServiceUrl = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';

    for (const username of usernames) {
      try {
        const resp = await fetch(`${userServiceUrl}/users/by/${username}`);
        if (!resp.ok) continue;
        const body = (await resp.json()) as { data?: { id?: string } };
        const mentionedUserId = body.data?.id;
        if (!mentionedUserId || mentionedUserId === actorId) continue;

        // Persist mention
        await prisma.mention.create({
          data: {
            id: uuidv4(),
            postId: commentId ? undefined : postId,
            commentId: commentId ?? undefined,
            mentionedUserId,
            actorId,
          },
        });

        const event: MentionEvent = {
          eventId: uuidv4(),
          timestamp: new Date().toISOString(),
          version: '1.0',
          topic: 'post.mention',
          payload: {
            mentionedUserId,
            actorId,
            actorUsername: username,
            postId,
            ...(commentId ? { commentId } : {}),
          },
        };
        await this.producer.publish(KAFKA_TOPICS.MENTION, event).catch(() => {});
      } catch {
        // ignore per-user errors
      }
    }
  }

  // Expose helper for use by comment service
  resolveMentionsAndPublish = this._resolveMentionsAndPublish.bind(this);
}
