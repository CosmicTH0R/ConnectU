import { prisma } from '../db';
import type { UpdateProfileInput, PaginationInput } from '../validators/user.validator';

export class UserService {
  // ─── Profile ────────────────────────────────────────────────────────────────

  async getById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profilePic: true,
        isPrivate: true,
        isVerified: true,
        followerCount: true,
        followingCount: true,
        postCount: true,
        createdAt: true,
      },
    });
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
    return user;
  }

  async getByUsername(username: string) {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() },
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profilePic: true,
        isPrivate: true,
        isVerified: true,
        followerCount: true,
        followingCount: true,
        postCount: true,
        createdAt: true,
      },
    });
    if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
    return user;
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    return prisma.user.update({
      where: { id: userId },
      data: input,
      select: {
        id: true,
        username: true,
        displayName: true,
        bio: true,
        profilePic: true,
        isPrivate: true,
        isVerified: true,
        followerCount: true,
        followingCount: true,
        postCount: true,
        updatedAt: true,
      },
    });
  }

  async searchUsers(query: string, pagination: PaginationInput) {
    const { limit, cursor } = pagination;
    const term = `%${query.toLowerCase()}%`;

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: query.toLowerCase() } },
          { displayName: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePic: true,
        isVerified: true,
        followerCount: true,
      },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { followerCount: 'desc' },
    });

    void term; // used as fallback reference — Prisma handles escaping
    const hasNext = users.length > limit;
    const items = hasNext ? users.slice(0, limit) : users;
    return {
      items,
      nextCursor: hasNext ? items[items.length - 1]?.id : null,
    };
  }
}
