import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import sharp, { Sharp } from 'sharp';
import { DeleteObjectsCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import type { ImageAsset } from '../models/ImageAsset';
import { ImageInputError, type ValidatedImage } from './imageValidation';

export type ImageKind = 'profile' | 'moment' | 'activity';
export type UploadInput = { image: ValidatedImage; kind: ImageKind; ownerId: string; deterministicKey?: string; preparedVariants?: ProcessedVariant[] };
export interface ImageStorage { upload(input: UploadInput): Promise<ImageAsset>; delete(storageKey: string): Promise<void>; }

export const IMMUTABLE_IMAGE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export type ProcessedVariant = { name: string; buffer: Buffer; width: number; height: number };
type R2Client = { send(command: PutObjectCommand | DeleteObjectsCommand): Promise<unknown> };
export type R2Config = { accountId: string; accessKeyId: string; secretAccessKey: string; bucket: string; publicBaseUrl: string };

const kindDirectory = (kind: ImageKind) => kind === 'profile' ? 'profiles' : kind === 'moment' ? 'moments' : 'activities';
const migrationId = (value: string) => `migration-${crypto.createHash('sha256').update(value).digest('hex').slice(0, 48)}`;
const storagePrefix = (kind: ImageKind, deterministicKey?: string) => (
  `${kindDirectory(kind)}/${deterministicKey ? migrationId(deterministicKey) : crypto.randomBytes(24).toString('hex')}`
);
const variantNames = (kind: ImageKind) => kind === 'profile' ? ['avatar.webp', 'thumb.webp']
  : kind === 'activity' ? ['cover.webp'] : ['image.webp'];
export const assertBoundedVariants = (kind: ImageKind, variants: ProcessedVariant[]) => {
  const limits = kind === 'profile' ? [2_000_000, 300_000] : kind === 'activity' ? [4_000_000] : [5_000_000];
  if (variants.length !== limits.length || variants.some((variant, index) => variant.name !== variantNames(kind)[index]
    || variant.buffer.length < 1 || variant.buffer.length > limits[index])) {
    throw new ImageInputError('This image is too large after processing. Please choose another image.');
  }
};
const objectKeys = (prefix: string) => {
  if (prefix.startsWith('profiles/')) return [`${prefix}/avatar.webp`, `${prefix}/thumb.webp`];
  if (prefix.startsWith('activities/')) return [`${prefix}/cover.webp`];
  return [`${prefix}/image.webp`];
};
const publicUrl = (baseUrl: string, key: string) => `${baseUrl.replace(/\/+$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;

export const processImageForDelivery = async (image: ValidatedImage, kind: ImageKind): Promise<ProcessedVariant[]> => {
  const source = sharp(image.buffer, { failOn: 'error' }).rotate();
  const make = async (name: string, pipeline: Sharp) => {
    const { data, info } = await pipeline.webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true });
    return { name, buffer: data, width: info.width, height: info.height };
  };
  if (kind === 'profile') {
    return Promise.all([
      make('avatar.webp', source.clone().resize(512, 512, { fit: 'cover', position: 'attention' })),
      make('thumb.webp', source.clone().resize(128, 128, { fit: 'cover', position: 'attention' })),
    ]);
  }
  if (kind === 'activity') {
    return [await make('cover.webp', source.resize(1200, 675, { fit: 'cover', position: 'attention' }))];
  }
  return [await make('image.webp', source.resize(1920, 1920, { fit: 'inside', withoutEnlargement: true }))];
};

export const readR2Config = (): R2Config => ({
  accountId: process.env.R2_ACCOUNT_ID || '',
  accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  bucket: process.env.R2_BUCKET_NAME || '',
  publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || '',
});

export class R2ImageStorage implements ImageStorage {
  private client: R2Client;

  constructor(private config: R2Config = readR2Config(), client?: R2Client) {
    const missing = Object.entries(config).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) throw new Error(`R2 image storage is missing configuration: ${missing.join(', ')}`);
    this.client = client || new S3Client({
      region: 'auto',
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  async upload({ image, kind, deterministicKey, preparedVariants }: UploadInput): Promise<ImageAsset> {
    const prefix = storagePrefix(kind, deterministicKey);
    const variants = preparedVariants || await processImageForDelivery(image, kind);
    assertBoundedVariants(kind, variants);
    const uploaded: string[] = [];
    try {
      for (const variant of variants) {
        const key = `${prefix}/${variant.name}`;
        await this.client.send(new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: key,
          Body: variant.buffer,
          ContentType: 'image/webp',
          CacheControl: IMMUTABLE_IMAGE_CACHE_CONTROL,
        }));
        uploaded.push(key);
      }
    } catch (error) {
      if (uploaded.length) {
        try {
          await this.client.send(new DeleteObjectsCommand({ Bucket: this.config.bucket, Delete: { Objects: uploaded.map((Key) => ({ Key })), Quiet: true } }));
        } catch { /* Best-effort cleanup of a partially uploaded variant set. */ }
      }
      throw error;
    }
    const main = variants[0];
    return {
      url: publicUrl(this.config.publicBaseUrl, `${prefix}/${main.name}`),
      thumbnailUrl: kind === 'profile' ? publicUrl(this.config.publicBaseUrl, `${prefix}/thumb.webp`) : undefined,
      storageKey: prefix,
      provider: 'r2',
      mimeType: 'image/webp',
      bytes: main.buffer.length,
      width: main.width,
      height: main.height,
    };
  }

  async delete(prefix: string) {
    await this.client.send(new DeleteObjectsCommand({
      Bucket: this.config.bucket,
      Delete: { Objects: objectKeys(prefix).map((Key) => ({ Key })), Quiet: true },
    }));
  }
}

class LocalDevelopmentStorage implements ImageStorage {
  private root = path.resolve(process.env.IMAGE_LOCAL_DIR || path.join(process.cwd(), 'uploads'));
  private baseUrl = (process.env.IMAGE_PUBLIC_BASE_URL || 'http://localhost:4000/uploads').replace(/\/$/, '');

  async upload({ image, kind, deterministicKey, preparedVariants }: UploadInput): Promise<ImageAsset> {
    const prefix = storagePrefix(kind, deterministicKey);
    const variants = preparedVariants || await processImageForDelivery(image, kind);
    assertBoundedVariants(kind, variants);
    for (const variant of variants) {
      const target = path.resolve(this.root, prefix, variant.name);
      if (!target.startsWith(`${this.root}${path.sep}`)) throw new Error('Invalid image storage key.');
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, variant.buffer);
    }
    const main = variants[0];
    return {
      url: publicUrl(this.baseUrl, `${prefix}/${main.name}`),
      thumbnailUrl: kind === 'profile' ? publicUrl(this.baseUrl, `${prefix}/thumb.webp`) : undefined,
      storageKey: prefix,
      provider: 'local',
      mimeType: 'image/webp',
      bytes: main.buffer.length,
      width: main.width,
      height: main.height,
    };
  }

  async delete(prefix: string) {
    const target = path.resolve(this.root, prefix);
    if (!target.startsWith(`${this.root}${path.sep}`)) return;
    await fs.rm(target, { recursive: true, force: true });
  }
}

let testStorage: ImageStorage | undefined;
export const setImageStorageForTests = (storage?: ImageStorage) => { testStorage = storage; };
export const getImageStorage = (): ImageStorage => {
  if (testStorage) return testStorage;
  if (process.env.IMAGE_STORAGE_PROVIDER === 'r2') return new R2ImageStorage();
  if (process.env.NODE_ENV !== 'production' && process.env.IMAGE_STORAGE_PROVIDER === 'local') return new LocalDevelopmentStorage();
  throw new Error('Image storage is not configured. Set IMAGE_STORAGE_PROVIDER=r2 with the required R2 variables.');
};

export const localImageDirectory = () => path.resolve(process.env.IMAGE_LOCAL_DIR || path.join(process.cwd(), 'uploads'));
