export type MediaType = 'image' | 'video';

export interface Post {
  id: string;
  userId: string;
  caption?: string;
  mediaUrls: string[];
  mediaType: MediaType;
  location?: string;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Like {
  id: string;
  postId: string;
  userId: string;
  createdAt: Date;
}

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  text: string;
  parentCommentId?: string;
  likeCount: number;
  replyCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Hashtag {
  id: string;
  name: string;
  postCount: number;
}

export interface SavedPost {
  id: string;
  userId: string;
  postId: string;
  createdAt: Date;
}

export interface PostWithAuthor extends Post {
  author: {
    id: string;
    username: string;
    profilePic?: string;
  };
  isLiked?: boolean;
  isSaved?: boolean;
}
