import { z } from 'zod';

// ─── Post ─────────────────────────────────────────────────────────────────────

export const CreatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  mediaUrls: z.array(z.string().url()).min(1, 'At least one media URL is required').max(10),
  mediaType: z.enum(['image', 'video']),
  location: z.string().max(255).optional(),
});

export const UpdatePostSchema = z.object({
  caption: z.string().max(2200).optional(),
  location: z.string().max(255).optional(),
});

// ─── Comment ─────────────────────────────────────────────────────────────────

export const CreateCommentSchema = z.object({
  text: z.string().min(1).max(2200),
  parentCommentId: z.string().uuid().optional(),
});

// ─── Pagination ───────────────────────────────────────────────────────────────

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const HashtagQuerySchema = z.object({
  hashtag: z.string().min(1).max(100).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePostInput    = z.infer<typeof CreatePostSchema>;
export type UpdatePostInput    = z.infer<typeof UpdatePostSchema>;
export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;
export type PaginationInput    = z.infer<typeof PaginationSchema>;
export type HashtagQueryInput  = z.infer<typeof HashtagQuerySchema>;
