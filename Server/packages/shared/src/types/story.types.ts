export type StoryMediaType = 'image' | 'video';
export type StoryAudience = 'public' | 'followers' | 'close_friends';

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption?: string;
  audience: StoryAudience;
  viewerCount: number;
  viewers: StoryViewer[];
  reactions: StoryReaction[];
  expiresAt: Date;
  createdAt: Date;
}

export interface StoryViewer {
  userId: string;
  viewedAt: Date;
}

export interface StoryReaction {
  userId: string;
  emoji: string;
  reactedAt: Date;
}

export interface StoryHighlight {
  id: string;
  userId: string;
  name: string;
  coverImage?: string;
  storyIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface StoriesFeedItem {
  userId: string;
  username: string;
  profilePic?: string;
  stories: Story[];
  hasUnviewed: boolean;
}
