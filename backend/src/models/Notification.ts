import { Schema, model } from 'mongoose';

export const notificationTypes = ['join_request', 'join_approved', 'join_declined', 'waitlist_promoted', 'participant_removed', 'activity_cancelled', 'activity_edited'] as const;
export type NotificationType = typeof notificationTypes[number];

const schema = new Schema({
  recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, enum: notificationTypes, required: true },
  activity: { type: Schema.Types.ObjectId, ref: 'Activity', required: true },
  title: { type: String, required: true, maxlength: 120 },
  body: { type: String, required: true, maxlength: 500 },
  readAt: { type: Date, default: null },
  idempotencyKey: { type: String, required: true },
  pushPending: { type: Boolean, default: false, select: false },
}, { timestamps: true });
schema.index({ recipient: 1, createdAt: -1, _id: -1 });
schema.index({ recipient: 1, readAt: 1 });
schema.index({ idempotencyKey: 1 }, { unique: true });
schema.index({ pushPending: 1, createdAt: 1 });
export default model('Notification', schema);
