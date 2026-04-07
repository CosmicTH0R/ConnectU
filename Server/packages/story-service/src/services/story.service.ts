import { Types } from 'mongoose';
import { Kafka } from 'kafkajs';
import { KafkaProducer, createEvent, KAFKA_TOPICS } from '@instagram/shared';
import { Story, StoryView, StoryReaction, IStory } from '../models';

const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CreateStoryInput {
  userId: string;
  mediaUrl: string;
  thumbnailUrl?: string;
  mediaType: 'image' | 'video';
  caption?: string;
  audience?: 'public' | 'followers' | 'close_friends';
}

export interface ViewerPage {
  viewers: { viewerId: string; viewedAt: Date }[];
  nextCursor: string | null;
}

export class StoryService {
  private producer: KafkaProducer;

  constructor(kafka: Kafka) {
    this.producer = new KafkaProducer(kafka);
  }

  // ─── Create ────────────────────────────────────────────────────────────────

  async createStory(input: CreateStoryInput): Promise<IStory> {
    const expiresAt = new Date(Date.now() + STORY_TTL_MS);

    const story = await Story.create({
      userId:       input.userId,
      mediaUrl:     input.mediaUrl,
      thumbnailUrl: input.thumbnailUrl,
      mediaType:    input.mediaType,
      caption:      input.caption,
      audience:     input.audience ?? 'followers',
      expiresAt,
    });

    await this.producer.publish(
      KAFKA_TOPICS.STORY_CREATED,
      createEvent(KAFKA_TOPICS.STORY_CREATED, {
        storyId:   story._id.toString(),
        userId:    input.userId,
        mediaType: input.mediaType,
      }),
    );

    return story;
  }

  // ─── Get single story + record view ───────────────────────────────────────

  async getStory(storyId: string, viewerId?: string, viewerUsername?: string): Promise<IStory> {
    const story = await Story.findById(storyId).lean<IStory>();
    if (!story) {
      throw Object.assign(new Error('Story not found'), { status: 404 });
    }

    // Record view if viewer is not the owner
    if (viewerId && viewerId !== story.userId) {
      const isNew = await this.recordView(storyId, viewerId);
      if (isNew) {
        await Story.updateOne({ _id: storyId }, { $inc: { viewerCount: 1 } });

        await this.producer.publish(
          KAFKA_TOPICS.STORY_VIEW,
          createEvent(KAFKA_TOPICS.STORY_VIEW, {
            storyId,
            storyOwnerId:  story.userId,
            viewerId,
            viewerUsername: viewerUsername ?? viewerId,
          }),
        );
      }
    }

    return story;
  }

  // ─── Feed (active stories from followed users) ─────────────────────────────

  async getFeed(followingIds: string[]): Promise<
    { userId: string; stories: IStory[] }[]
  > {
    if (followingIds.length === 0) return [];

    const now = new Date();
    const stories = await Story.find({
      userId:    { $in: followingIds },
      expiresAt: { $gt: now },
    })
      .sort({ userId: 1, createdAt: -1 })
      .lean<IStory[]>();

    // Group by userId, sorted by latest story createdAt
    const map = new Map<string, IStory[]>();
    for (const s of stories) {
      const existing = map.get(s.userId) ?? [];
      existing.push(s);
      map.set(s.userId, existing);
    }

    // Sort groups by latest story timestamp descending
    return [...map.entries()]
      .sort(([, a], [, b]) => b[0].createdAt.getTime() - a[0].createdAt.getTime())
      .map(([userId, userStories]) => ({ userId, stories: userStories }));
  }

  // ─── User's active stories ────────────────────────────────────────────────

  async getUserStories(userId: string): Promise<IStory[]> {
    return Story.find({ userId, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1 })
      .lean<IStory[]>();
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteStory(storyId: string, userId: string): Promise<void> {
    const story = await Story.findById(storyId);
    if (!story) throw Object.assign(new Error('Story not found'), { status: 404 });
    if (story.userId !== userId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    await Story.deleteOne({ _id: storyId });
    await StoryView.deleteMany({ storyId: new Types.ObjectId(storyId) });
    await StoryReaction.deleteMany({ storyId: new Types.ObjectId(storyId) });

    await this.producer.publish(
      KAFKA_TOPICS.STORY_DELETED,
      createEvent(KAFKA_TOPICS.STORY_DELETED, { storyId, userId }),
    );
  }

  // ─── React ────────────────────────────────────────────────────────────────

  async reactToStory(
    storyId: string,
    userId: string,
    username: string,
    emoji: string,
  ): Promise<void> {
    const story = await Story.findById(storyId).lean<IStory>();
    if (!story) throw Object.assign(new Error('Story not found'), { status: 404 });

    await StoryReaction.findOneAndUpdate(
      { storyId: new Types.ObjectId(storyId), userId },
      { emoji },
      { upsert: true, new: true },
    );

    await this.producer.publish(
      KAFKA_TOPICS.STORY_REACTION,
      createEvent(KAFKA_TOPICS.STORY_REACTION, {
        storyId,
        storyOwnerId:   story.userId,
        reactorId:      userId,
        reactorUsername: username,
        emoji,
      }),
    );
  }

  // ─── Viewers (owner only) ─────────────────────────────────────────────────

  async getViewers(
    storyId: string,
    ownerId: string,
    cursor?: string,
    limit = 20,
  ): Promise<ViewerPage> {
    const story = await Story.findById(storyId).lean<IStory>();
    if (!story) throw Object.assign(new Error('Story not found'), { status: 404 });
    if (story.userId !== ownerId) throw Object.assign(new Error('Forbidden'), { status: 403 });

    const filter: Record<string, unknown> = { storyId: new Types.ObjectId(storyId) };
    if (cursor) {
      filter['_id'] = { $lt: new Types.ObjectId(cursor) };
    }

    const views = await StoryView.find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = views.length > limit;
    const page = hasMore ? views.slice(0, limit) : views;

    return {
      viewers:    page.map(v => ({ viewerId: v.viewerId, viewedAt: v.viewedAt })),
      nextCursor: hasMore ? page[page.length - 1]._id.toString() : null,
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private async recordView(storyId: string, viewerId: string): Promise<boolean> {
    try {
      await StoryView.create({
        storyId:  new Types.ObjectId(storyId),
        viewerId,
        viewedAt: new Date(),
      });
      return true;
    } catch {
      // Unique constraint violation → already viewed
      return false;
    }
  }
}
