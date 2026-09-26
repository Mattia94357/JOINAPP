import { Schema, model } from 'mongoose';

const schema = new Schema({
  // Random installation identifier, not a hardware identifier.
  _id: { type: String, required: true },
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  expoPushToken: { type: String, required: true, select: false },
  platform: { type: String, enum: ['ios', 'android'], required: true },
  projectId: { type: String, required: true },
  registrationId: { type: String, required: true, select: false },
  lastSeenAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
}, { timestamps: true });
schema.index({ expoPushToken: 1 }, { unique: true });
schema.index({ user: 1, revokedAt: 1, lastSeenAt: -1 });
export default model('PushDevice', schema);
