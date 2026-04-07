export const SERVICE_PORTS = {
  API_GATEWAY: 3000,
  GRAPHQL_GATEWAY: 4000,
  USER_SERVICE: 3001,
  POST_SERVICE: 3002,
  FEED_SERVICE: 3003,
  STORY_SERVICE: 3004,
  CHAT_SERVICE: 3005,
  NOTIFICATION_SERVICE: 3006,
  MEDIA_SERVICE: 3007,
  SEARCH_SERVICE: 3008,
  RECOMMENDATION_SERVICE: 3009,
  FEATURE_FLAG_SERVICE: 3010,
  AB_TESTING_SERVICE: 3011,
} as const;

export const KAFKA_TOPICS = {
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  FOLLOW: 'user.follow',
  UNFOLLOW: 'user.unfollow',

  // Post events
  POST_CREATED: 'post.created',
  POST_DELETED: 'post.deleted',
  LIKE: 'post.like',
  UNLIKE: 'post.unlike',
  COMMENT: 'post.comment',
  COMMENT_DELETED: 'post.comment.deleted',
  MENTION: 'post.mention',

  // Story events
  STORY_CREATED: 'story.created',
  STORY_DELETED: 'story.deleted',
  STORY_VIEW: 'story.view',
  STORY_REACTION: 'story.reaction',

  // Chat events
  MESSAGE_SENT: 'chat.message.sent',

  // Media events
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DELETED: 'media.deleted',

  // Reel events
  REEL_VIEW: 'reel.view',
  REEL_LIKE: 'reel.like',

  // System events
  RATE_LIMIT_EXCEEDED: 'system.rate_limit_exceeded',
  FLAG_UPDATED: 'system.flag_updated',
} as const;

export type KafkaTopic = (typeof KAFKA_TOPICS)[keyof typeof KAFKA_TOPICS];

export const REDIS_KEYS = {
  userFeed: (userId: string) => `feed:user:${userId}`,
  userPresence: (userId: string) => `presence:${userId}`,
  userOnline: (userId: string) => `online:${userId}`,
  refreshToken: (userId: string) => `refresh:${userId}`,
  revokedToken: (jti: string) => `revoked:${jti}`,
  rateLimitKey: (identifier: string, endpoint: string) => `ratelimit:${identifier}:${endpoint}`,
  notificationCount: (userId: string) => `notif:unread:${userId}`,
  featureFlags: (userId: string) => `flags:${userId}`,
  recommendedFeed: (userId: string) => `recfeed:${userId}`,
  recentSearches: (userId: string) => `search:recent:${userId}`,
  offlineMessages: (userId: string) => `offline:msgs:${userId}`,
  userInteractions: (userId: string) => `interactions:${userId}`,
} as const;

export const FEED_MAX_SIZE = 500;
export const CELEBRITY_FOLLOWER_THRESHOLD = 10_000;
export const STORY_TTL_HOURS = 24;
export const PRESENCE_TTL_SECONDS = 30;
export const HEARTBEAT_INTERVAL_MS = 15_000;
export const FEED_CACHE_TTL_SECONDS = 300;
export const FLAG_CACHE_TTL_SECONDS = 30;
