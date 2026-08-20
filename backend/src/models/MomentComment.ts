import { Schema, model, Document, Types } from 'mongoose';

export interface IMomentComment extends Document {
  moment: Types.ObjectId;
  author: Types.ObjectId;
  text: string;
  clientRequestId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MomentCommentSchema = new Schema<IMomentComment>({
  moment: { type: Schema.Types.ObjectId, ref: 'Moment', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  text: { type: String, required: true, maxlength: 400 },
  clientRequestId: { type: String, maxlength: 64 },
}, { timestamps: true });

MomentCommentSchema.index({ moment: 1, createdAt: 1 });
MomentCommentSchema.index(
  { moment: 1, author: 1, clientRequestId: 1 },
  { unique: true, sparse: true },
);

export default model<IMomentComment>('MomentComment', MomentCommentSchema);
