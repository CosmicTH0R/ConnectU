import { z } from 'zod';

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const RegisterSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-zA-Z0-9_.]+$/, 'Username can only contain letters, numbers, dots, and underscores'),
  email: z.string().email(),
  password: z
    .string()
    .min(8)
    .max(72)
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
});

export const LoginSchema = z.object({
  login: z.string().min(1), // email or username
  password: z.string().min(1),
});

// ─── User profile ─────────────────────────────────────────────────────────────

export const UpdateProfileSchema = z.object({
  bio: z.string().max(150).optional(),
  profilePic: z.string().url().optional(),
  isPrivate: z.boolean().optional(),
});

// ─── Post ─────────────────────────────────────────────────────────────────────

export const CreatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  mediaUrls: z.array(z.string().url()).min(1).max(10),
  mediaType: z.enum(['image', 'video']),
  location: z.string().max(100).optional(),
});

// ─── Comment ──────────────────────────────────────────────────────────────────

export const CreateCommentSchema = z.object({
  text: z.string().min(1).max(2200),
  parentCommentId: z.string().uuid().optional(),
});

// ─── Story ────────────────────────────────────────────────────────────────────

export const CreateStorySchema = z.object({
  mediaUrl: z.string().url(),
  mediaType: z.enum(['image', 'video']),
  caption: z.string().max(2200).optional(),
  audience: z.enum(['public', 'followers', 'close_friends']).default('followers'),
});

// ─── Message ──────────────────────────────────────────────────────────────────

export const SendMessageSchema = z.object({
  text: z.string().min(1).max(10_000).optional(),
  mediaUrl: z.string().url().optional(),
  sharedPostId: z.string().uuid().optional(),
  type: z.enum(['text', 'image', 'video', 'post_share', 'story_reply']).default('text'),
}).refine(
  (data) => data.text ?? data.mediaUrl ?? data.sharedPostId,
  { message: 'Message must have text, media, or a shared post' },
);

export const CreateConversationSchema = z.object({
  participantIds: z.array(z.string().uuid()).min(1).max(255),
  type: z.enum(['direct', 'group']).default('direct'),
  name: z.string().max(100).optional(),
});

// ─── Feature flag ─────────────────────────────────────────────────────────────

export const CreateFeatureFlagSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9_-]+$/, 'Key must be lowercase alphanumeric with dashes or underscores'),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  enabled: z.boolean().default(false),
  rolloutPercentage: z.number().min(0).max(100).default(0),
  targetUsers: z.array(z.string().uuid()).default([]),
  targetGroups: z.array(z.string()).default([]),
});

// ─── A/B Experiment ───────────────────────────────────────────────────────────

export const CreateExperimentSchema = z.object({
  key: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9_-]+$/),
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  variants: z
    .array(
      z.object({
        key: z.string().min(1).max(50),
        name: z.string().min(1).max(100),
        weight: z.number().min(0).max(100),
        config: z.record(z.unknown()).default({}),
      }),
    )
    .min(2)
    .max(10),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ─── Search ───────────────────────────────────────────────────────────────────

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

// ─── Exported types ───────────────────────────────────────────────────────────

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type CreateStoryInput = z.infer<typeof CreateStorySchema>;
export type SendMessageInput = z.infer<typeof SendMessageSchema>;
export type CreateConversationInput = z.infer<typeof CreateConversationSchema>;
export type CreateFeatureFlagInput = z.infer<typeof CreateFeatureFlagSchema>;
export type CreateExperimentInput = z.infer<typeof CreateExperimentSchema>;
export type SearchQueryInput = z.infer<typeof SearchQuerySchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
