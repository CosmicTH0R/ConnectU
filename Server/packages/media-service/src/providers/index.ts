import { MinioProvider } from './minio.provider';
import { CloudinaryProvider } from './cloudinary.provider';
import { StorageProvider } from './storage.provider';

let _provider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_provider) {
    _provider = process.env.MEDIA_PROVIDER === 'cloudinary'
      ? new CloudinaryProvider()
      : new MinioProvider();
  }
  return _provider;
}

export type { StorageProvider } from './storage.provider';
export type { UploadResult, SignedUploadUrl } from './storage.provider';

