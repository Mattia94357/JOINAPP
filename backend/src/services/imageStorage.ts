import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { ImageAsset } from '../models/ImageAsset';
import type { ValidatedImage } from './imageValidation';

export type ImageKind = 'profile' | 'moment' | 'activity';
export type UploadInput = { image: ValidatedImage; kind: ImageKind; ownerId: string; deterministicKey?: string };
export interface ImageStorage { upload(input: UploadInput): Promise<ImageAsset>; delete(storageKey: string): Promise<void>; }

const randomKey = (kind: ImageKind, ownerId: string, extension: string) =>
  `${kind}/${ownerId}/${crypto.randomBytes(24).toString('hex')}.${extension}`;

const sign = (params: Record<string, string | number>, secret: string) => crypto.createHash('sha1')
  .update(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('&') + secret)
  .digest('hex');

class CloudinaryStorage implements ImageStorage {
  private cloud = process.env.CLOUDINARY_CLOUD_NAME!;
  private apiKey = process.env.CLOUDINARY_API_KEY!;
  private secret = process.env.CLOUDINARY_API_SECRET!;

  async upload({ image, kind, ownerId, deterministicKey }: UploadInput): Promise<ImageAsset> {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = (process.env.CLOUDINARY_FOLDER || 'join').replace(/^\/+|\/+$/g, '');
    const rawKey = deterministicKey || randomKey(kind, ownerId, image.extension);
    const publicId = `${folder}/${rawKey.replace(/\.[^.]+$/, '')}`;
    const transformation = kind === 'profile' ? 'c_fill,g_auto,w_512,h_512,q_auto:good' : 'c_limit,w_1920,h_1920,q_auto:good';
    const eager = kind === 'profile' ? 'c_fill,g_auto,w_128,h_128,q_auto:good' : undefined;
    const signed: Record<string, string | number> = { public_id: publicId, timestamp, transformation, overwrite: 'true' };
    if (eager) signed.eager = eager;
    const form = new FormData();
    form.set('file', new Blob([Uint8Array.from(image.buffer)], { type: image.mimeType }), `upload.${image.extension}`);
    Object.entries(signed).forEach(([key, value]) => form.set(key, String(value)));
    form.set('api_key', this.apiKey);
    form.set('signature', sign(signed, this.secret));
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloud)}/image/upload`, { method: 'POST', body: form });
    const result: any = await response.json();
    if (!response.ok || !result.secure_url) throw new Error('Image storage upload failed.');
    return { url: result.secure_url, thumbnailUrl: result.eager?.[0]?.secure_url, storageKey: result.public_id,
      provider: 'cloudinary', mimeType: image.mimeType, bytes: result.bytes || image.buffer.length,
      width: result.width || image.width, height: result.height || image.height };
  }

  async delete(storageKey: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const signed = { public_id: storageKey, timestamp };
    const form = new URLSearchParams({ public_id: storageKey, timestamp: String(timestamp), api_key: this.apiKey, signature: sign(signed, this.secret) });
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(this.cloud)}/image/destroy`, { method: 'POST', body: form });
    if (!response.ok) throw new Error('Image storage cleanup failed.');
  }
}

class LocalDevelopmentStorage implements ImageStorage {
  private root = path.resolve(process.env.IMAGE_LOCAL_DIR || path.join(process.cwd(), 'uploads'));
  private baseUrl = (process.env.IMAGE_PUBLIC_BASE_URL || 'http://localhost:4000/uploads').replace(/\/$/, '');
  async upload({ image, kind, ownerId, deterministicKey }: UploadInput): Promise<ImageAsset> {
    const storageKey = deterministicKey || randomKey(kind, ownerId, image.extension);
    const target = path.resolve(this.root, storageKey);
    if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error('Invalid image storage key.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, image.buffer);
    return { url: `${this.baseUrl}/${storageKey.split(path.sep).join('/')}`, storageKey, provider: 'local', mimeType: image.mimeType,
      bytes: image.buffer.length, width: image.width, height: image.height };
  }
  async delete(storageKey: string) {
    const target = path.resolve(this.root, storageKey);
    if (!target.startsWith(`${this.root}${path.sep}`)) return;
    await fs.rm(target, { force: true });
  }
}

let testStorage: ImageStorage | undefined;
export const setImageStorageForTests = (storage?: ImageStorage) => { testStorage = storage; };
export const getImageStorage = (): ImageStorage => {
  if (testStorage) return testStorage;
  if (process.env.IMAGE_STORAGE_PROVIDER === 'cloudinary') return new CloudinaryStorage();
  if (process.env.NODE_ENV !== 'production' && process.env.IMAGE_STORAGE_PROVIDER === 'local') return new LocalDevelopmentStorage();
  throw new Error('Image storage is not configured.');
};

export const localImageDirectory = () => path.resolve(process.env.IMAGE_LOCAL_DIR || path.join(process.cwd(), 'uploads'));
