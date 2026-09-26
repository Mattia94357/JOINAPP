import { Schema, model, Document, Types } from 'mongoose';

export interface IUserReport extends Document {
  reporter: Types.ObjectId;
  reportedUser?: Types.ObjectId;
  targetType?: 'user' | 'activity' | 'moment' | 'comment';
  targetId?: Types.ObjectId;
  detail?: string;
  reason?: string;
  status: 'open' | 'reviewed' | 'actioned' | 'dismissed';
}

const UserReportSchema = new Schema<IUserReport>({
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  reportedUser: { type: Schema.Types.ObjectId, ref: 'User' },
  targetType: { type: String, enum: ['user', 'activity', 'moment', 'comment'] },
  targetId: { type: Schema.Types.ObjectId },
  reason: { type: String, maxlength: 80 },
  detail: { type: String, maxlength: 1000 },
  status: { type: String, enum: ['open', 'reviewed', 'actioned', 'dismissed'], default: 'open' },
}, { timestamps: true });

// Legacy user-only reports remain readable. New reports deduplicate per reporter/target.
UserReportSchema.index({ reporter: 1, targetType: 1, targetId: 1 }, {
  unique: true, partialFilterExpression: { targetType: { $exists: true }, targetId: { $exists: true } },
});
UserReportSchema.index({ status: 1, createdAt: 1 });

export default model<IUserReport>('UserReport', UserReportSchema);
