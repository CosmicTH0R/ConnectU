import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { KafkaProducer, KAFKA_TOPICS } from '@instagram/shared';
import type { LikeEvent, UnlikeEvent } from '@instagram/shared';
import type { PaginationInput } from '../validators/post.validator';

export class LikeService {
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

  // ─── Like a post ───────────────────────────────────────────────────────────

  async likePost(postId: string, userId: string, username: string): Promise<void> {
    const post = await prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, userId: true },
    });
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (existing) throw Object.assign(new Error('Already liked'), { status: 409 });

    await prisma.$transaction([
      prisma.like.create({ data: { postId, userId } }),
      prisma.post.update({ where: { id: postId }, data: { likeCount: { increment: 1 } } }),
    ]);

    const event: LikeEvent = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0',
      topic: 'post.like',
      payload: {
        postId,
        postOwnerId: post.userId,
        likerId: userId,
        likerUsername: username,
      },
    };
    await this.producer.publish(KAFKA_TOPICS.LIKE, event).catch(() => {});
  }

  // ─── Unlike a post ────────────────────────────────────────────────────────

  async unlikePost(postId: string, userId: string): Promise<void> {
    const existing = await prisma.like.findUnique({
      where: { postId_userId: { postId, userId } },
    });
    if (!existing) throw Object.assign(new Error('Not liked'), { status: 404 });

    await prisma.$transaction([
      prisma.like.delete({ where: { postId_userId: { postId, userId } } }),
      prisma.post.update({ where: { id: postId }, data: { likeCount: { decrement: 1 } } }),
    ]);

    const event: UnlikeEvent = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0',
      topic: 'post.unlike',
      payload: { postId, userId },
    };
    await this.producer.publish(KAFKA_TOPICS.UNLIKE, event).catch(() => {});
  }

  // ─── List likes ───────────────────────────────────────────────────────────

  async getLikes(postId: string, pagination: PaginationInput) {
    const { cursor, limit } = pagination;
    const likes = await prisma.like.findMany({
      where: {
        postId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      select: { userId: true, createdAt: true },
    });

    const hasMore = likes.length > limit;
    const items = hasMore ? likes.slice(0, limit) : likes;
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;

    return { items: items.map((l) => ({ userId: l.userId, likedAt: l.createdAt })), nextCursor, hasMore };
  }
}
