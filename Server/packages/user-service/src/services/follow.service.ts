import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import type { PaginationInput } from '../validators/user.validator';
import { KafkaProducer, KAFKA_TOPICS } from '@instagram/shared';
import type { FollowEvent, UnfollowEvent } from '@instagram/shared';

export class FollowService {
  private producer: KafkaProducer;

  constructor() {
    const kafka = new Kafka({
      clientId: 'user-service',
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

  // ─── Follow a user ──────────────────────────────────────────────────────────

  async follow(followerId: string, followingId: string): Promise<{ status: string }> {
    if (followerId === followingId) {
      throw Object.assign(new Error('You cannot follow yourself'), { status: 400 });
    }

    // Verify target user exists and get their privacy setting
    const target = await prisma.user.findUnique({
      where: { id: followingId },
      select: { id: true, username: true, isPrivate: true },
    });
    if (!target) throw Object.assign(new Error('User not found'), { status: 404 });

    const follower = await prisma.user.findUnique({
      where: { id: followerId },
      select: { username: true },
    });

    // Determine follow status
    const status = target.isPrivate ? 'PENDING' : 'ACCEPTED';

    // Upsert follow record (idempotent)
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: {
        id: uuidv4(),
        followerId,
        followingId,
        status: status as 'PENDING' | 'ACCEPTED',
      },
      update: { status: status as 'PENDING' | 'ACCEPTED' },
    });

    // Update counters only for accepted follows
    if (status === 'ACCEPTED') {
      await prisma.$transaction([
        prisma.user.update({ where: { id: followerId },  data: { followingCount: { increment: 1 } } }),
        prisma.user.update({ where: { id: followingId }, data: { followerCount:  { increment: 1 } } }),
      ]);

      const event: FollowEvent = {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        version: '1.0',
        topic: 'user.follow',
        payload: {
          followerId,
          followingId,
          followerUsername: follower?.username ?? '',
        },
      };
      await this.producer.publish(KAFKA_TOPICS.FOLLOW, event).catch(() => {
        // Non-fatal: log but don't fail the request
      });
    }

    return { status };
  }

  // ─── Unfollow ───────────────────────────────────────────────────────────────

  async unfollow(followerId: string, followingId: string): Promise<void> {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
      select: { status: true },
    });
    if (!existing) throw Object.assign(new Error('Follow relationship not found'), { status: 404 });

    await prisma.follow.delete({
      where: { followerId_followingId: { followerId, followingId } },
    });

    if (existing.status === 'ACCEPTED') {
      await prisma.$transaction([
        prisma.user.update({ where: { id: followerId },  data: { followingCount: { decrement: 1 } } }),
        prisma.user.update({ where: { id: followingId }, data: { followerCount:  { decrement: 1 } } }),
      ]);

      const event: UnfollowEvent = {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        version: '1.0',
        topic: 'user.unfollow',
        payload: { followerId, followingId },
      };
      await this.producer.publish(KAFKA_TOPICS.UNFOLLOW, event).catch(() => {});
    }
  }

  // ─── Accept / reject follow request ────────────────────────────────────────

  async respondToRequest(
    ownerId: string,
    followerId: string,
    action: 'accept' | 'reject',
  ): Promise<void> {
    const existing = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId: ownerId } },
      select: { status: true },
    });
    if (!existing || existing.status !== 'PENDING') {
      throw Object.assign(new Error('Pending follow request not found'), { status: 404 });
    }

    if (action === 'accept') {
      await prisma.follow.update({
        where: { followerId_followingId: { followerId, followingId: ownerId } },
        data: { status: 'ACCEPTED' },
      });
      await prisma.$transaction([
        prisma.user.update({ where: { id: followerId }, data: { followingCount: { increment: 1 } } }),
        prisma.user.update({ where: { id: ownerId },    data: { followerCount:  { increment: 1 } } }),
      ]);
    } else {
      await prisma.follow.delete({
        where: { followerId_followingId: { followerId, followingId: ownerId } },
      });
    }
  }

  // ─── Followers list ─────────────────────────────────────────────────────────

  async getFollowers(userId: string, pagination: PaginationInput) {
    const { limit, cursor } = pagination;
    const rows = await prisma.follow.findMany({
      where: { followingId: userId, status: 'ACCEPTED' },
      select: {
        followerId: true,
        follower: {
          select: { id: true, username: true, displayName: true, profilePic: true, isVerified: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: cursor, followingId: userId } }, skip: 1 } : {}),
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r: typeof rows[number]) => r.follower),
      nextCursor: hasNext ? items[items.length - 1]?.followerId ?? null : null,
    };
  }

  // ─── Following list ─────────────────────────────────────────────────────────

  async getFollowing(userId: string, pagination: PaginationInput) {
    const { limit, cursor } = pagination;
    const rows = await prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: {
        followingId: true,
        following: {
          select: { id: true, username: true, displayName: true, profilePic: true, isVerified: true },
        },
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { followerId_followingId: { followerId: userId, followingId: cursor } }, skip: 1 } : {}),
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;
    return {
      items: items.map((r: typeof rows[number]) => r.following),
      nextCursor: hasNext ? items[items.length - 1]?.followingId ?? null : null,
    };
  }

  // ─── Follow status ──────────────────────────────────────────────────────────

  async getFollowStatus(viewerId: string, targetId: string) {
    const follow = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: targetId } },
      select: { status: true },
    });
    return { status: follow?.status?.toLowerCase() ?? 'none' };
  }
}
