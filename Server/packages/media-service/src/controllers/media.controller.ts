import { Request, Response } from 'express';
import { MediaService } from '../services/media.service';
import { JobService } from '../services/job.service';
import { UploadQuerySchema, SignedUrlSchema } from '../validators/media.validator';

export class MediaController {
  constructor(
    private readonly mediaService: MediaService,
    private readonly jobService:   JobService,
  ) {}

  // POST /media/upload
  async upload(req: Request, res: Response): Promise<void> {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const file = req.file;
    if (!file) { res.status(400).json({ error: 'No file provided' }); return; }

    const parsed = UploadQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    try {
      const result = await this.mediaService.upload(
        userId,
        file.buffer,
        parsed.data.folder,
        file.originalname,
      );
      res.status(201).json(result);
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      res.status(e.status ?? 500).json({ error: e.message ?? 'Upload failed' });
    }
  }

  // POST /media/upload-url
  async getUploadUrl(req: Request, res: Response): Promise<void> {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const parsed = SignedUrlSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.flatten() });
      return;
    }

    const { folder, filename, mimeType } = parsed.data;
    const result = await this.mediaService.getSignedUploadUrl(userId, folder, filename, mimeType);
    res.json(result);
  }

  // DELETE /media/*
  async deleteMedia(req: Request, res: Response): Promise<void> {
    const userId = (req as Request & { userId?: string }).userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    // Express wildcard param captured as '0' in router.delete('/*')
    const key = (req.params as Record<string, string>)[0];
    if (!key) { res.status(400).json({ error: 'Missing key' }); return; }

    try {
      await this.mediaService.deleteMedia(userId, key);
      res.status(204).end();
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      res.status(e.status ?? 500).json({ error: e.message ?? 'Delete failed' });
    }
  }

  // GET /media/jobs/:jobId
  async getJobStatus(req: Request, res: Response): Promise<void> {
    const { jobId } = req.params;
    const job = await this.jobService.getJob(jobId);
    if (!job) { res.status(404).json({ error: 'Job not found' }); return; }
    res.json(job);
  }
}
