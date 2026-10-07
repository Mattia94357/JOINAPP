import { Schema, model } from 'mongoose';

const ImageUploadCounterSchema = new Schema({
  _id: { type: String, required: true },
  files: { type: Number, default: 0 },
  bytes: { type: Number, default: 0 },
  users: { type: Map, of: Number, default: {} },
  ips: { type: Map, of: Number, default: {} },
  expiresAt: { type: Date, required: true },
}, { versionKey: false });

ImageUploadCounterSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default model('ImageUploadCounter', ImageUploadCounterSchema);
