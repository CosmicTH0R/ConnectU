import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { KafkaProducer, KAFKA_TOPICS } from '@instagram/shared';
import type { CommentEvent } from '@instagram/shared';
import type { CreateCommentInput, PaginationInput } from '../validators/post.validator';

// ─── Extract @mentions from text ─────────────────────────────────────────────

function extractMentions(text: string): string[] {
  const matches = text.match(/@([a-zA-Z0-9_.]+)/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

export class CommentService {
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

  // ─── Add Comment ──────────────────────────────────────────────────────────

  async addComment(postId: string, userId: string, username: string, input: CreateCommentInput) {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true, userId: true } });
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

    // Validate parent comment belongs to same post
    if (input.parentCommentId) {
      const parent = await prisma.comment.findUnique({
        where: { id: input.parentCommentId },
        select: { postId: true },
      });
      if (!parent || parent.postId !== postId) {
        throw Object.assign(new Error('Parent comment not found on this post'), { status: 400 });
      }
    }

    const comment = await prisma.$transaction(async (tx) => {
      const c = await tx.comment.create({
        data: {
          id: uuidv4(),
          postId,
          userId,
          text: input.text,
          parentCommentId: input.parentCommentId,
        },
      });
      await tx.post.update({ where: { id: postId }, data: { commentCount: { increment: 1 } } });
      return c;
    });

    const event: CommentEvent = {
      eventId: uuidv4(),
      timestamp: new Date().toISOString(),
      version: '1.0',
      topic: 'post.comment',
      payload: {
        commentId: comment.id,
        postId,
        postOwnerId: post.userId,
        commenterId: userId,
        commenterUsername: username,
        text: input.text,
        parentCommentId: input.parentCommentId,
      },
    };
    await this.producer.publish(KAFKA_TOPICS.COMMENT, event).catch(() => {});

    // Handle @mentions in comment (best-effort)
    const mentionUsernames = extractMentions(input.text);
    if (mentionUsernames.length > 0) {
      this._resolveMentionsAndPublish(userId, postId, comment.id, mentionUsernames).catch(() => {});
    }

    return comment;
  }

  // ─── Get top-level comments ───────────────────────────────────────────────

  async getComments(postId: string, pagination: PaginationInput) {
    const { cursor, limit } = pagination;
    const comments = await prisma.comment.findMany({
      where: {
        postId,
        parentCommentId: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
    });

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;

    return { items, nextCursor, hasMore };
  }

  // ─── Get replies ──────────────────────────────────────────────────────────

  async getReplies(commentId: string, pagination: PaginationInput) {
    // Ensure parent comment exists
    const parent = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
    if (!parent) throw Object.assign(new Error('Comment not found'), { status: 404 });

    const { cursor, limit } = pagination;
    const replies = await prisma.comment.findMany({
      where: {
        parentCommentId: commentId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: limit + 1,
    });

    const hasMore = replies.length > limit;
    const items = hasMore ? replies.slice(0, limit) : replies;
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;

    return { items, nextCursor, hasMore };
  }

  // ─── Delete Comment ───────────────────────────────────────────────────────

  async deleteComment(commentId: string, requesterId: string): Promise<void> {
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true, postId: true },
    });
    if (!comment) throw Object.assign(new Error('Comment not found'), { status: 404 });

    // Post owner can also delete comments
    const post = await prisma.post.findUnique({ where: { id: comment.postId }, select: { userId: true } });

    if (comment.userId !== requesterId && post?.userId !== requesterId) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }

    await prisma.$transaction([
      prisma.comment.delete({ where: { id: commentId } }),
      prisma.post.update({ where: { id: comment.postId }, data: { commentCount: { decrement: 1 } } }),
    ]);

    await this.producer
      .publish(KAFKA_TOPICS.COMMENT_DELETED, {
        eventId: uuidv4(),
        timestamp: new Date().toISOString(),
        version: '1.0' as const,
        topic: 'post.comment.deleted' as const,
        payload: { commentId, postId: comment.postId, deletedBy: requesterId },
      })
      .catch(() => {});
  }

  // ─── Like a comment ───────────────────────────────────────────────────────

  async likeComment(commentId: string, userId: string): Promise<void> {
    const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { id: true } });
    if (!comment) throw Object.assign(new Error('Comment not found'), { status: 404 });

    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    if (existing) throw Object.assign(new Error('Already liked'), { status: 409 });

    await prisma.$transaction([
      prisma.commentLike.create({ data: { commentId, userId } }),
      prisma.comment.update({ where: { id: commentId }, data: { likeCount: { increment: 1 } } }),
    ]);
  }

  // ─── Unlike a comment ────────────────────────────────────────────────────

  async unlikeComment(commentId: string, userId: string): Promise<void> {
    const existing = await prisma.commentLike.findUnique({
      where: { commentId_userId: { commentId, userId } },
    });
    if (!existing) throw Object.assign(new Error('Not liked'), { status: 404 });

    await prisma.$transaction([
      prisma.commentLike.delete({ where: { commentId_userId: { commentId, userId } } }),
      prisma.comment.update({ where: { id: commentId }, data: { likeCount: { decrement: 1 } } }),
    ]);
  }

  // ─── Resolve mentions ─────────────────────────────────────────────────────

  private async _resolveMentionsAndPublish(
    actorId: string,
    postId: string,
    commentId: string,
    usernames: string[],
  ): Promise<void> {
    const userServiceUrl = process.env.USER_SERVICE_URL ?? 'http://localhost:3001';

    for (const username of usernames) {
      try {
        const resp = await fetch(`${userServiceUrl}/users/by/${username}`);
        if (!resp.ok) continue;
        const body = (await resp.json()) as { data?: { id?: string } };
        const mentionedUserId = body.data?.id;
        if (!mentionedUserId || mentionedUserId === actorId) continue;

        await prisma.mention.create({
          data: {
            id: uuidv4(),
            postId,
            commentId,
            mentionedUserId,
            actorId,
          },
        });

        await this.producer
          .publish(KAFKA_TOPICS.MENTION, {
            eventId: uuidv4(),
            timestamp: new Date().toISOString(),
            version: '1.0' as const,
            topic: 'post.mention' as const,
            payload: {
              mentionedUserId,
              actorId,
              actorUsername: username,
              postId,
              commentId,
            },
          })
          .catch(() => {});
      } catch {
        // ignore per-user errors
      }
    }
  }
}
