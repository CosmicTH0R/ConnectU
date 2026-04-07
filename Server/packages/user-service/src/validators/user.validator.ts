import { z } from 'zod';

export const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(60).optional(),
  bio: z.string().max(150).optional(),
  profilePic: z.string().url('Invalid URL for profilePic').optional(),
  isPrivate: z.boolean().optional(),
});

export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;
export type PaginationInput = z.infer<typeof PaginationSchema>;
