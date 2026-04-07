export interface UploadResult {
  key: string;
  originalUrl: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  mimeType: string;
  size: number;
}

export interface SignedUploadUrl {
  uploadUrl: string;
  key: string;
  publicUrl: string;
  method: 'PUT' | 'POST';
  fields?: Record<string, string>;
  expiresAt: number;
}

export interface StorageProvider {
  upload(buffer: Buffer, key: string, mimeType: string): Promise<UploadResult>;
  delete(key: string): Promise<void>;
  getSignedUploadUrl(key: string, mimeType: string): Promise<SignedUploadUrl>;
  getPublicUrl(key: string): string;
  generateVideoThumbnail?(key: string, onComplete: (url: string | null) => void): void;
}
