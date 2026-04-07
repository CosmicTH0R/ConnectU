import { prisma } from '../db';
import type { PaginationInput } from '../validators/post.validator';

export class SaveService {
  // ─── Save a post ──────────────────────────────────────────────────────────

  async savePost(postId: string, userId: string): Promise<void> {
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
    if (!post) throw Object.assign(new Error('Post not found'), { status: 404 });

    const existing = await prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (existing) throw Object.assign(new Error('Already saved'), { status: 409 });

    await prisma.$transaction([
      prisma.savedPost.create({ data: { userId, postId } }),
      prisma.post.update({ where: { id: postId }, data: { saveCount: { increment: 1 } } }),
    ]);
  }

  // ─── Unsave a post ────────────────────────────────────────────────────────

  async unsavePost(postId: string, userId: string): Promise<void> {
    const existing = await prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    if (!existing) throw Object.assign(new Error('Not saved'), { status: 404 });

    await prisma.$transaction([
      prisma.savedPost.delete({ where: { userId_postId: { userId, postId } } }),
      prisma.post.update({ where: { id: postId }, data: { saveCount: { decrement: 1 } } }),
    ]);
  }

  // ─── List saved posts ─────────────────────────────────────────────────────

  async getSavedPosts(userId: string, pagination: PaginationInput) {
    const { cursor, limit } = pagination;
    const saved = await prisma.savedPost.findMany({
      where: {
        userId,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        post: { include: { hashtags: { include: { hashtag: true } } } },
      },
    });

    const hasMore = saved.length > limit;
    const items = hasMore ? saved.slice(0, limit) : saved;
    const nextCursor = hasMore ? items[items.length - 1]!.createdAt.toISOString() : null;

    return {
      items: items.map((s) => ({
        savedAt: s.createdAt,
        post: {
          id: s.post.id,
          userId: s.post.userId,
          caption: s.post.caption,
          mediaUrls: s.post.mediaUrls,
          mediaType: s.post.mediaType,
          location: s.post.location,
          likeCount: s.post.likeCount,
          commentCount: s.post.commentCount,
          saveCount: s.post.saveCount,
          hashtags: s.post.hashtags.map((ph) => ph.hashtag.name),
          createdAt: s.post.createdAt,
          updatedAt: s.post.updatedAt,
        },
      })),
      nextCursor,
      hasMore,
    };
  }

  // ─── Save status ──────────────────────────────────────────────────────────

  async getSaveStatus(postId: string, userId: string): Promise<{ saved: boolean }> {
    const saved = await prisma.savedPost.findUnique({
      where: { userId_postId: { userId, postId } },
    });
    return { saved: saved !== null };
  }
}
