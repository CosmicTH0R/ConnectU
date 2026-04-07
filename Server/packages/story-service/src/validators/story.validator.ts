import { z } from 'zod';

export const CreateStorySchema = z.object({
  mediaUrl:     z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  mediaType:    z.enum(['image', 'video']),
  caption:      z.string().max(2200).optional(),
  audience:     z.enum(['public', 'followers', 'close_friends']).optional(),
});

export const ReactSchema = z.object({
  emoji: z.string().min(1).max(8),
});

export const CreateHighlightSchema = z.object({
  title:    z.string().min(1).max(100),
  coverUrl: z.string().url().optional(),
  storyIds: z.array(z.string().length(24)).min(1).max(100),
});

export const UpdateHighlightSchema = z.object({
  title:    z.string().min(1).max(100).optional(),
  coverUrl: z.string().url().optional(),
}).refine(d => d.title !== undefined || d.coverUrl !== undefined, {
  message: 'At least one field must be provided',
});
