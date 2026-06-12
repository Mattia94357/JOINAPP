import { Schema, model, Document, Types } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar?: string;
  profilePictureUrl?: string;
  profileThumbnailUrl?: string;
  pushToken?: string;
  profileCompleted?: boolean;
  location?: string;
  interests?: string[];
  verified?: boolean;
  bio?: string;
  aboutMe?: string;
  languages?: string[];
  instagram?: string;
  ageRange?: string;
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  publicGender?: boolean;
  hostRating?: number;
  activityRating?: number;
  reviewCount?: number;
  hostedCount?: number;
  joinedCount?: number;
  locationPublic?: boolean;
  hostedActivitiesPublic?: boolean;
  joinedActivitiesPublic?: boolean;
  blockedUsers?: Types.ObjectId[];
  savedActivities?: Types.ObjectId[];
  hasCompletedOnboardingTutorial?: boolean;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String },
  profilePictureUrl: { type: String },
  profileThumbnailUrl: { type: String },
  pushToken: { type: String },
  profileCompleted: { type: Boolean, default: false },
  location: { type: String },
  interests: [{ type: String }],
  verified: { type: Boolean, default: false },
  bio: { type: String },
  aboutMe: { type: String },
  languages: [{ type: String }],
  instagram: { type: String },
  ageRange: { type: String },
  gender: { type: String, enum: ['male', 'female', 'non_binary', 'prefer_not_to_say'] },
  publicGender: { type: Boolean, default: false },
  hostRating: { type: Number, default: 4.8 },
  activityRating: { type: Number, default: 0 },
  reviewCount: { type: Number, default: 0 },
  hostedCount: { type: Number, default: 0 },
  joinedCount: { type: Number, default: 0 },
  locationPublic: { type: Boolean, default: true },
  hostedActivitiesPublic: { type: Boolean, default: true },
  joinedActivitiesPublic: { type: Boolean, default: true },
  blockedUsers: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  savedActivities: [{ type: Schema.Types.ObjectId, ref: 'Activity' }],
  hasCompletedOnboardingTutorial: { type: Boolean, default: false },
  passwordResetTokenHash: { type: String },
  passwordResetExpires: { type: Date },
}, { timestamps: true });

export default model<IUser>('User', UserSchema);
