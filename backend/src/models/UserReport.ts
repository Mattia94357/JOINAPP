import { Schema, model, Document, Types } from 'mongoose';

export interface IUserReport extends Document {
  reporter: Types.ObjectId;
  reportedUser: Types.ObjectId;
  reason?: string;
  status: 'open' | 'reviewed' | 'dismissed';
}

const UserReportSchema = new Schema<IUserReport>({
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String },
  status: { type: String, enum: ['open', 'reviewed', 'dismissed'], default: 'open' },
}, { timestamps: true });

export default model<IUserReport>('UserReport', UserReportSchema);
