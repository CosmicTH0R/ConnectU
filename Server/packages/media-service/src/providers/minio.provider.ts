import { Client as MinioClient } from 'minio';
import { StorageProvider, UploadResult, SignedUploadUrl } from './storage.provider';

const MINIO_ENDPOINT  = process.env.MINIO_ENDPOINT  || 'localhost';
const MINIO_PORT      = parseInt(process.env.MINIO_PORT || '9000', 10);
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minio';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minio123';
const MINIO_BUCKET    = process.env.MINIO_BUCKET     || 'media';
const MINIO_PUBLIC_URL = process.env.MINIO_PUBLIC_URL || `http://${MINIO_ENDPOINT}:${MINIO_PORT}`;
// Signed URL TTL in seconds (15 min)
const SIGNED_URL_TTL  = 15 * 60;

const minio = new MinioClient({
  endPoint:  MINIO_ENDPOINT,
  port:      MINIO_PORT,
  useSSL:    false,
  accessKey: MINIO_ACCESS_KEY,
  secretKey: MINIO_SECRET_KEY,
});

async function ensureBucket(): Promise<void> {
  const exists = await minio.bucketExists(MINIO_BUCKET);
  if (!exists) await minio.makeBucket(MINIO_BUCKET, 'us-east-1');
}

export class MinioProvider implements StorageProvider {
  async upload(buffer: Buffer, key: string, mimeType: string): Promise<UploadResult> {
    await ensureBucket();
    await minio.putObject(MINIO_BUCKET, key, buffer, buffer.length, { 'Content-Type': mimeType });
    return {
      key,
      originalUrl: this.getPublicUrl(key),
      mimeType,
      size: buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    await minio.removeObject(MINIO_BUCKET, key);
  }

  async getSignedUploadUrl(key: string, _mimeType: string): Promise<SignedUploadUrl> {
    await ensureBucket();
    const uploadUrl = await minio.presignedPutObject(MINIO_BUCKET, key, SIGNED_URL_TTL);
    return {
      uploadUrl,
      key,
      publicUrl: this.getPublicUrl(key),
      method:    'PUT',
      expiresAt: Date.now() + SIGNED_URL_TTL * 1000,
    };
  }

  getPublicUrl(key: string): string {
    return `${MINIO_PUBLIC_URL}/${MINIO_BUCKET}/${key}`;
  }

  generateVideoThumbnail(_key: string, onComplete: (url: string | null) => void): void {
    // MinIO has no server-side video processing — caller handles thumbnails via sharp/ffmpeg
    onComplete(null);
  }
}
