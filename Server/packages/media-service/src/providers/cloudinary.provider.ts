import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, UploadResult, SignedUploadUrl } from './storage.provider';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Signed upload URL TTL in seconds (15 min)
const SIGNED_TTL = 15 * 60;

export class CloudinaryProvider implements StorageProvider {
  async upload(buffer: Buffer, key: string, mimeType: string): Promise<UploadResult> {
    const publicId     = key.replace(/\.[^/.]+$/, ''); // strip extension
    const resourceType = mimeType.startsWith('video/') ? 'video' : 'image';

    const result = await new Promise<{ secure_url: string; bytes: number; eager?: { secure_url: string }[] }>(
      (resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id:     publicId,
            resource_type: resourceType,
            eager:         resourceType === 'image'
              ? [
                  { width: 200, height: 200, crop: 'fill', format: 'jpg' },
                  { width: 800, crop: 'limit',             format: 'jpg' },
                ]
              : [],
          },
          (error, res) => {
            if (error || !res) return reject(error ?? new Error('Cloudinary upload failed'));
            resolve(res as { secure_url: string; bytes: number; eager?: { secure_url: string }[] });
          },
        );
        stream.end(buffer);
      },
    );

    return {
      key,
      originalUrl:  result.secure_url,
      thumbnailUrl: result.eager?.[0]?.secure_url,
      mediumUrl:    result.eager?.[1]?.secure_url,
      mimeType,
      size:         result.bytes,
    };
  }

  async delete(key: string): Promise<void> {
    const publicId = key.replace(/\.[^/.]+$/, '');
    await cloudinary.uploader.destroy(publicId);
  }

  async getSignedUploadUrl(_key: string, _mimeType: string): Promise<SignedUploadUrl> {
    const timestamp = Math.round(Date.now() / 1000);
    const apiSecret = process.env.CLOUDINARY_API_SECRET ?? '';
    const params    = { timestamp };
    const signature = cloudinary.utils.api_sign_request(params, apiSecret);

    const uploadUrl = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/auto/upload`;
    return {
      uploadUrl,
      key:       '',
      publicUrl: '',
      method:    'POST',
      fields: {
        api_key:   process.env.CLOUDINARY_API_KEY ?? '',
        timestamp: String(timestamp),
        signature,
      },
      expiresAt: Date.now() + SIGNED_TTL * 1000,
    };
  }

  getPublicUrl(key: string): string {
    return cloudinary.url(key.replace(/\.[^/.]+$/, ''));
  }

  generateVideoThumbnail(key: string, onComplete: (url: string | null) => void): void {
    const publicId = key.replace(/\.[^/.]+$/, '');
    cloudinary.uploader.explicit(publicId, { type: 'upload', resource_type: 'video', eager: [{ format: 'jpg' }] })
      .then(r => onComplete((r as { eager?: { secure_url: string }[] }).eager?.[0]?.secure_url ?? null))
      .catch(() => onComplete(null));
  }
}
