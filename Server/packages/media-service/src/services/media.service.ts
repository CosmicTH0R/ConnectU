import Redis from 'ioredis';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { fromBuffer } from 'file-type';
import { StorageProvider, UploadResult } from '../providers/storage.provider';
import { JobService, MediaJob } from './job.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/quicktime',
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;  // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB
const RATE_LIMIT_MAX  = 20;
const RATE_LIMIT_TTL  = 60; // seconds
const OWNER_TTL       = 30 * 24 * 60 * 60; // 30 days

// ─── Redis key helpers ────────────────────────────────────────────────────────

function ownerKey(key: string)  { return `media:owner:${key}`; }
function rlKey(userId: string)  { return `media:rl:${userId}`; }

// ─── Service ─────────────────────────────────────────────────────────────────

export class MediaService {
  constructor(
    private redis:    Redis,
    private provider: StorageProvider,
    private jobs:     JobService,
  ) {}

  // ─── Upload ────────────────────────────────────────────────────────────────

  async upload(
    userId:       string,
    buffer:       Buffer,
    folder:       string,
    _originalName: string,
  ): Promise<UploadResult & { jobId?: string }> {
    // 1. MIME validation from buffer (not extension)
    const detected = await fromBuffer(buffer);
    const mimeType = detected?.mime ?? 'application/octet-stream';

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw Object.assign(new Error(`Unsupported file type: ${mimeType}`), { status: 415 });
    }

    // 2. Size limits
    const isVideo = mimeType.startsWith('video/');
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (buffer.length > maxBytes) {
      throw Object.assign(new Error(`File too large. Max ${maxBytes / 1024 / 1024} MB.`), { status: 413 });
    }

    // 3. Rate limiting  (20 uploads / 60 s per user)
    const rl    = await this.redis.incr(rlKey(userId));
    if (rl === 1) await this.redis.expire(rlKey(userId), RATE_LIMIT_TTL);
    if (rl > RATE_LIMIT_MAX) {
      throw Object.assign(new Error('Upload rate limit exceeded'), { status: 429 });
    }

    // 4. For images: strip EXIF + generate variants via sharp
    let uploadBuffer = buffer;
    if (!isVideo) {
      uploadBuffer = await sharp(buffer)
        .rotate()          // auto-rotate from EXIF orientation
        .withMetadata({})  // strip all EXIF
        .toBuffer();
    }

    // 5. Build storage key
    const ext = detected?.ext ?? 'bin';
    const key = `${folder.replace(/\/$/, '')}/${uuidv4()}.${ext}`;

    // 6. Upload original
    const result = await this.provider.upload(uploadBuffer, key, mimeType);

    // 7. Generate thumbnail + medium variants (images only, synchronous)
    if (!isVideo) {
      const baseKey = key.replace(/\.[^/.]+$/, '');

      const [thumbBuf, medBuf] = await Promise.all([
        sharp(uploadBuffer).resize(200, 200, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer(),
        sharp(uploadBuffer).resize(800, undefined, { fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer(),
      ]);

      const [thumbRes, medRes] = await Promise.all([
        this.provider.upload(thumbBuf, `${baseKey}.thumb.jpg`, 'image/jpeg'),
        this.provider.upload(medBuf,   `${baseKey}.medium.jpg`, 'image/jpeg'),
      ]);

      result.thumbnailUrl = thumbRes.originalUrl;
      result.mediumUrl    = medRes.originalUrl;
    }

    // 8. Store ownership so delete endpoint can authorise
    await this.redis.setex(ownerKey(key), OWNER_TTL, userId);

    // 9. For videos: kick off async thumbnail job
    let jobId: string | undefined;
    if (isVideo) {
      jobId = uuidv4();
      const job: MediaJob = {
        jobId,
        userId,
        key,
        status:    'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      await this.jobs.createJob(job);

      // Non-blocking — provider calls onComplete when thumbnail is ready
      this.provider.generateVideoThumbnail?.(key, (url) => {
        if (url) {
          result.thumbnailUrl = url;
          this.jobs.completeJob(jobId!, { thumbnailUrl: url }).catch(() => undefined);
        } else {
          this.jobs.failJob(jobId!, 'Thumbnail generation failed').catch(() => undefined);
        }
      });
    }

    return { ...result, jobId };
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async deleteMedia(userId: string, key: string): Promise<void> {
    // Ownership check
    const owner = await this.redis.get(ownerKey(key));
    if (owner && owner !== userId) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }

    await this.provider.delete(key);
    await this.redis.del(ownerKey(key));

    // Best-effort cleanup of derived variant keys
    const baseKey = key.replace(/\.[^/.]+$/, '');
    await Promise.allSettled([
      this.provider.delete(`${baseKey}.thumb.jpg`),
      this.provider.delete(`${baseKey}.medium.jpg`),
    ]);
  }

  // ─── Signed upload URL ────────────────────────────────────────────────────

  async getSignedUploadUrl(userId: string, folder: string, filename: string, mimeType: string) {
    const ext = filename.split('.').pop() ?? 'bin';
    const key = `${folder.replace(/\/$/, '')}/${uuidv4()}.${ext}`;
    const result = await this.provider.getSignedUploadUrl(key, mimeType);
    // Pre-register ownership so a future delete works
    await this.redis.setex(ownerKey(key), OWNER_TTL, userId);
    return result;
  }
}

