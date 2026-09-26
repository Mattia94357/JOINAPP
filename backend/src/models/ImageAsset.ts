import { Schema } from 'mongoose';

export type ImageAsset = {
  url: string;
  thumbnailUrl?: string;
  storageKey: string;
  provider: 'cloudinary' | 'local' | 'legacy-external';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: number;
  width: number;
  height: number;
};

export const ImageAssetSchema = new Schema<ImageAsset>({
  url: { type: String, required: true, maxlength: 2048 },
  thumbnailUrl: { type: String, maxlength: 2048 },
  storageKey: { type: String, required: true, maxlength: 300 },
  provider: { type: String, required: true, enum: ['cloudinary', 'local', 'legacy-external'] },
  mimeType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  bytes: { type: Number, required: true, min: 1 },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
}, { _id: false });
