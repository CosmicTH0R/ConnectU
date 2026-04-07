export type ConversationType = 'direct' | 'group';
export type MessageType = 'text' | 'image' | 'video' | 'post_share' | 'story_reply';

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  participants: string[];
  lastMessage?: MessagePreview;
  unreadCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessagePreview {
  id: string;
  senderId: string;
  text?: string;
  type: MessageType;
  createdAt: Date;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  sharedPostId?: string;
  type: MessageType;
  readBy: MessageReadReceipt[];
  deliveredTo: string[];
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MessageReadReceipt {
  userId: string;
  readAt: Date;
}

export interface TypingIndicator {
  conversationId: string;
  userId: string;
  username: string;
}
