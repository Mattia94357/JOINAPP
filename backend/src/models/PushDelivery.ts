import { Schema, model } from 'mongoose';

const schema = new Schema({
  notification: { type: Schema.Types.ObjectId, ref: 'Notification', required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  device: { type: String, ref: 'PushDevice', required: true },
  registrationId: { type: String, required: true },
  state: { type: String, enum: ['pending', 'claimed', 'sending', 'ticket', 'delivered', 'failed', 'unknown', 'skipped'], default: 'pending' },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now },
  leaseUntil: Date,
  leaseId: String,
  ticketId: String,
  receiptChecks: { type: Number, default: 0 },
  errorCode: String,
}, { timestamps: true });
schema.index({ notification: 1, device: 1 }, { unique: true });
schema.index({ state: 1, nextAttemptAt: 1 });
schema.index({ state: 1, leaseUntil: 1 });
export default model('PushDelivery', schema);
