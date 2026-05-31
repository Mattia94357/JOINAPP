import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  avatar?: string;
  location?: string;
  interests?: string[];
  verified?: boolean;
  bio?: string;
}

const UserSchema = new Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  avatar: { type: String },
  location: { type: String },
  interests: [{ type: String }],
  verified: { type: Boolean, default: false },
  bio: { type: String },
}, { timestamps: true });

export default model<IUser>('User', UserSchema);
