import { Schema, model, Document, Types } from 'mongoose';
import { ImageAsset, ImageAssetSchema } from './ImageAsset';

export interface IMoment extends Document {
  creator: Types.ObjectId;
  activity: Types.ObjectId;
  images?: string[];
  imageAssets: ImageAsset[];
  clientRequestId?: string;
  caption?: string;
  likes: Types.ObjectId[];
  commentCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const MomentSchema = new Schema<IMoment>({
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  activity: { type: Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  images: [{ type: String, select: false }],
  imageAssets: { type: [ImageAssetSchema], default: undefined },
  clientRequestId: { type: String, maxlength: 64 },
  caption: { type: String, maxlength: 280 },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  commentCount: { type: Number, default: 0, min: 0 },
}, { timestamps: true });

MomentSchema.index({ creator: 1, createdAt: -1 });
MomentSchema.index({ activity: 1, createdAt: -1 });
MomentSchema.index({ creator: 1, clientRequestId: 1 }, { unique: true, sparse: true });

export default model<IMoment>('Moment', MomentSchema);
