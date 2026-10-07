import { Schema, model, Document, Types } from 'mongoose';
import { notificationTypes } from './Notification';
import { ImageAsset, ImageAssetSchema } from './ImageAsset';

export interface IActivity extends Document {
  title: string;
  category: string;
  location: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  isApproximateLocation?: boolean;
  locationPrivacy?: 'public' | 'approximate' | 'private';
  description: string;
  host: Types.ObjectId;
  hostDeleted?: boolean;
  participants: Types.ObjectId[];
  pendingParticipants?: Types.ObjectId[];
  declinedParticipants?: Types.ObjectId[];
  waitlist?: Types.ObjectId[];
  invitedUsers?: Types.ObjectId[];
  date: Date;
  endDate?: Date;
  ageGroup?: 'any' | '18-24' | '25-34' | '35-44' | '45+';
  coverImage?: string;
  coverImageAsset?: ImageAsset;
  clientRequestId?: string;
  galleryImages?: string[];
  vibe?: string;
  availabilityTag?: string;
  maxAttendees?: number;
  venueName?: string;
  exactAddress?: string;
  costType?: 'Free' | 'Paid';
  costAmount?: number;
  currency?: 'AUD';
  hostNote?: string;
  cancellationPolicy?: string;
  visibility?: 'public' | 'private';
  joinApproval?: 'auto' | 'manual';
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  cancellationReason?: string;
  inviteCode?: string;
  activityRating?: number;
  reviewCount?: number;
  notificationEvents?: any[];
}

const ActivitySchema = new Schema<IActivity>({
  title: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  locationName: { type: String },
  latitude: { type: Number, min: -90, max: 90 },
  longitude: { type: Number, min: -180, max: 180 },
  isApproximateLocation: { type: Boolean, default: false },
  locationPrivacy: { type: String, enum: ['public', 'approximate', 'private'], default: 'public' },
  description: { type: String, required: true },
  host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  hostDeleted: { type: Boolean, default: false },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  pendingParticipants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  declinedParticipants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  waitlist: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  invitedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  date: { type: Date, default: Date.now },
  endDate: { type: Date },
  ageGroup: { type: String, enum: ['any', '18-24', '25-34', '35-44', '45+'], default: 'any' },
  coverImage: { type: String },
  coverImageAsset: { type: ImageAssetSchema },
  clientRequestId: { type: String, maxlength: 64 },
  galleryImages: [{ type: String }],
  vibe: { type: String },
  availabilityTag: { type: String },
  maxAttendees: { type: Number },
  venueName: { type: String, maxlength: 120 },
  exactAddress: { type: String, maxlength: 240 },
  costType: { type: String, enum: ['Free', 'Paid'], default: 'Free' },
  costAmount: { type: Number, min: 0, default: 0 },
  currency: { type: String, enum: ['AUD'], default: 'AUD' },
  hostNote: { type: String, maxlength: 500 },
  cancellationPolicy: { type: String, maxlength: 500 },
  visibility: { type: String, enum: ['public', 'private'], default: 'public' },
  joinApproval: { type: String, enum: ['auto', 'manual'], default: 'auto' },
  status: { type: String, enum: ['active', 'full', 'cancelled', 'completed'], default: 'active' },
  cancellationReason: { type: String },
  inviteCode: { type: String },
  activityRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  notificationEvents: { type: [new Schema({
    type: { type: String, enum: notificationTypes, required: true },
    actor: { type: Schema.Types.ObjectId, ref: 'User' },
    recipients: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, required: true },
  })], default: [], select: false },
}, { timestamps: true });

ActivitySchema.index({ createdAt: -1 });
ActivitySchema.index({ host: 1, createdAt: -1 });
ActivitySchema.index({ host: 1, clientRequestId: 1 }, { unique: true, partialFilterExpression: { clientRequestId: { $type: 'string' } } });
ActivitySchema.index({ participants: 1, createdAt: -1 });
ActivitySchema.index({ visibility: 1, status: 1, createdAt: -1 });
ActivitySchema.index({ category: 1, status: 1, date: 1 });
ActivitySchema.index({ latitude: 1, longitude: 1 });
ActivitySchema.index({ 'notificationEvents.createdAt': 1 }, { partialFilterExpression: { 'notificationEvents.0': { $exists: true } } });

export default model<IActivity>('Activity', ActivitySchema);
