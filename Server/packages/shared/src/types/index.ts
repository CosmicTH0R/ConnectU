export * from './user.types';
export * from './post.types';
export * from './story.types';
export * from './message.types';
export * from './notification.types';

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor?: string;
  hasMore: boolean;
  total?: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface RequestWithUser extends Express.Request {
  user?: {
    id: string;
    username: string;
  };
  requestId?: string;
  flags?: Record<string, boolean>;
}
