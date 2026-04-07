import { z } from 'zod';

export const UploadQuerySchema = z.object({
  folder: z.string().min(1).regex(/^[a-z0-9_/-]+$/, 'folder must be alphanumeric path'),
});

export const SignedUrlSchema = z.object({
  folder:   z.string().min(1).regex(/^[a-z0-9_/-]+$/),
  filename: z.string().min(1).max(200),
  mimeType: z.string().min(1),
});

export type UploadQuery  = z.infer<typeof UploadQuerySchema>;
export type SignedUrlBody = z.infer<typeof SignedUrlSchema>;

