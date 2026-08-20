import { Schema, model, Document, Types } from 'mongoose';

export interface IMoment extends Document {
  creator: Types.ObjectId;
  activity: Types.ObjectId;
  images: string[];
  caption?: string;
  likes: Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const MomentSchema = new Schema<IMoment>({
  creator: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  activity: { type: Schema.Types.ObjectId, ref: 'Activity', required: true, index: true },
  images: [{ type: String, required: true }],
  caption: { type: String, maxlength: 280 },
  likes: [{ type: Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });

MomentSchema.index({ creator: 1, createdAt: -1 });
MomentSchema.index({ activity: 1, createdAt: -1 });

export default model<IMoment>('Moment', MomentSchema);
