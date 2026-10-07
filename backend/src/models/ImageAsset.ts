import { Schema } from 'mongoose';

export type ImageAsset = {
  url: string;
  thumbnailUrl?: string;
  storageKey: string;
  provider: 'r2' | 'cloudinary' | 'local' | 'legacy-external';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  bytes: number;
  width: number;
  height: number;
  sourceHash?: string;
};

export const ImageAssetSchema = new Schema<ImageAsset>({
  url: { type: String, required: true, maxlength: 2048 },
  thumbnailUrl: { type: String, maxlength: 2048 },
  storageKey: { type: String, required: true, maxlength: 300 },
  provider: { type: String, required: true, enum: ['r2', 'cloudinary', 'local', 'legacy-external'] },
  mimeType: { type: String, required: true, enum: ['image/jpeg', 'image/png', 'image/webp'] },
  bytes: { type: Number, required: true, min: 1 },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },
  sourceHash: { type: String, match: /^[a-f0-9]{64}$/ },
}, { _id: false });
