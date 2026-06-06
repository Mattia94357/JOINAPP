import { Schema, model, Document, Types } from 'mongoose';

export interface IActivity extends Document {
  title: string;
  category: string;
  location: string;
  description: string;
  host: Types.ObjectId;
  participants: Types.ObjectId[];
  pendingParticipants?: Types.ObjectId[];
  waitlist?: Types.ObjectId[];
  invitedUsers?: Types.ObjectId[];
  date: Date;
  coverImage?: string;
  galleryImages?: string[];
  vibe?: string;
  availabilityTag?: string;
  maxAttendees?: number;
  visibility?: 'public' | 'private';
  joinApproval?: 'auto' | 'manual';
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  cancellationReason?: string;
  inviteCode?: string;
  activityRating?: number;
  reviewCount?: number;
}

const ActivitySchema = new Schema<IActivity>({
  title: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  pendingParticipants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  waitlist: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  invitedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  date: { type: Date, default: Date.now },
  coverImage: { type: String },
  galleryImages: [{ type: String }],
  vibe: { type: String },
  availabilityTag: { type: String },
  maxAttendees: { type: Number },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  joinApproval: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  status: { type: String, enum: ['active', 'full', 'cancelled', 'completed'], default: 'active' },
  cancellationReason: { type: String },
  inviteCode: { type: String },
  activityRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
}, { timestamps: true });

export default model<IActivity>('Activity', ActivitySchema);
