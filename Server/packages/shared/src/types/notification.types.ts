export type NotificationType =
  | 'like'
  | 'comment'
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'story_view'
  | 'story_reaction'
  | 'mention'
  | 'message'
  | 'reel_like'
  | 'reel_comment';

export interface Notification {
  id: string;
  userId: string;
  actorId: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, unknown>;
  isRead: boolean;
  createdAt: Date;
}

export interface NotificationPreferences {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  types: Partial<Record<NotificationType, boolean>>;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  badge?: number;
}
