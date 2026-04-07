export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  bio?: string;
  profilePic?: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserPublicProfile {
  id: string;
  username: string;
  bio?: string;
  profilePic?: string;
  isPrivate: boolean;
  followerCount: number;
  followingCount: number;
  postCount: number;
}

export interface Follow {
  id: string;
  followerId: string;
  followingId: string;
  status: FollowStatus;
  createdAt: Date;
}

export type FollowStatus = 'pending' | 'accepted' | 'rejected';

export interface Presence {
  userId: string;
  isOnline: boolean;
  lastSeen: Date;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  username: string;
  iat?: number;
  exp?: number;
}
