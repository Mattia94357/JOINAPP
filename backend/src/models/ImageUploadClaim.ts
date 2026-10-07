import { Schema, model } from 'mongoose';

const ImageUploadClaimSchema = new Schema({
  _id: { type: String, required: true },
  status: { type: String, enum: ['pending', 'complete'], required: true },
  targetId: { type: String },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

ImageUploadClaimSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model('ImageUploadClaim', ImageUploadClaimSchema);
