import { KafkaTopic } from '../constants';

// ─── Base event structure ─────────────────────────────────────────────────────

export interface KafkaEventBase {
  eventId: string;
  timestamp: string;
  version: '1.0';
}

// ─── User events ─────────────────────────────────────────────────────────────

export interface UserCreatedEvent extends KafkaEventBase {
  topic: 'user.created';
  payload: {
    userId: string;
    username: string;
    email: string;
  };
}

export interface FollowEvent extends KafkaEventBase {
  topic: 'user.follow';
  payload: {
    followerId: string;
    followingId: string;
    followerUsername: string;
  };
}

export interface UnfollowEvent extends KafkaEventBase {
  topic: 'user.unfollow';
  payload: {
    followerId: string;
    followingId: string;
  };
}

// ─── Post events ─────────────────────────────────────────────────────────────

export interface PostCreatedEvent extends KafkaEventBase {
  topic: 'post.created';
  payload: {
    postId: string;
    userId: string;
    mediaType: 'image' | 'video';
    hashtags: string[];
    caption?: string;
  };
}

export interface PostDeletedEvent extends KafkaEventBase {
  topic: 'post.deleted';
  payload: {
    postId: string;
    userId: string;
  };
}

export interface LikeEvent extends KafkaEventBase {
  topic: 'post.like';
  payload: {
    postId: string;
    postOwnerId: string;
    likerId: string;
    likerUsername: string;
  };
}

export interface UnlikeEvent extends KafkaEventBase {
  topic: 'post.unlike';
  payload: {
    postId: string;
    userId: string;
  };
}

export interface CommentEvent extends KafkaEventBase {
  topic: 'post.comment';
  payload: {
    commentId: string;
    postId: string;
    postOwnerId: string;
    commenterId: string;
    commenterUsername: string;
    text: string;
    parentCommentId?: string;
  };
}

export interface CommentDeletedEvent extends KafkaEventBase {
  topic: 'post.comment.deleted';
  payload: {
    commentId: string;
    postId: string;
    deletedBy: string;
  };
}

export interface MentionEvent extends KafkaEventBase {
  topic: 'post.mention';
  payload: {
    mentionedUserId: string;
    actorId: string;
    actorUsername: string;
    postId?: string;
    commentId?: string;
  };
}

// ─── Story events ─────────────────────────────────────────────────────────────

export interface StoryCreatedEvent extends KafkaEventBase {
  topic: 'story.created';
  payload: {
    storyId: string;
    userId: string;
    mediaType: 'image' | 'video';
  };
}

export interface StoryViewEvent extends KafkaEventBase {
  topic: 'story.view';
  payload: {
    storyId: string;
    storyOwnerId: string;
    viewerId: string;
    viewerUsername: string;
  };
}

export interface StoryReactionEvent extends KafkaEventBase {
  topic: 'story.reaction';
  payload: {
    storyId: string;
    storyOwnerId: string;
    reactorId: string;
    reactorUsername: string;
    emoji: string;
  };
}

// ─── Chat events ──────────────────────────────────────────────────────────────

export interface MessageSentEvent extends KafkaEventBase {
  topic: 'chat.message.sent';
  payload: {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderUsername: string;
    recipientIds: string[];
  };
}

// ─── Reel events ──────────────────────────────────────────────────────────────

export interface ReelViewEvent extends KafkaEventBase {
  topic: 'reel.view';
  payload: {
    reelId: string;
    reelOwnerId: string;
    viewerId: string;
    watchDurationMs: number;
    completionRate: number;
  };
}

// ─── System events ────────────────────────────────────────────────────────────

export interface RateLimitExceededEvent extends KafkaEventBase {
  topic: 'system.rate_limit_exceeded';
  payload: {
    identifier: string;
    endpoint: string;
    limit: number;
    ip: string;
  };
}

export interface FlagUpdatedEvent extends KafkaEventBase {
  topic: 'system.flag_updated';
  payload: {
    flagKey: string;
    enabled: boolean;
    rolloutPercentage: number;
  };
}

// ─── Union type for all events ────────────────────────────────────────────────

export type KafkaEvent =
  | UserCreatedEvent
  | FollowEvent
  | UnfollowEvent
  | PostCreatedEvent
  | PostDeletedEvent
  | LikeEvent
  | UnlikeEvent
  | CommentEvent
  | CommentDeletedEvent
  | MentionEvent
  | StoryCreatedEvent
  | StoryViewEvent
  | StoryReactionEvent
  | MessageSentEvent
  | ReelViewEvent
  | RateLimitExceededEvent
  | FlagUpdatedEvent;

// ─── Helper to create typed events ───────────────────────────────────────────

export function createEvent<T extends KafkaEvent>(
  topic: KafkaTopic,
  payload: T['payload'],
): T {
  return {
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    version: '1.0',
    topic,
    payload,
  } as T;
}
