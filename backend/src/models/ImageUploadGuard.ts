import { Schema, model, Types } from 'mongoose';

const ImageUploadGuardSchema = new Schema({
  _id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  pending: { type: Number, default: 0 },
  lease: { type: String },
  updatedAt: { type: Date, default: Date.now },
}, { versionKey: false });

export default model<{ _id: Types.ObjectId; pending: number; lease?: string; updatedAt: Date }>('ImageUploadGuard', ImageUploadGuardSchema);
