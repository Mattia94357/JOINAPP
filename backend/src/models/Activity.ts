import { Schema, model, Document, Types } from 'mongoose';

export interface IActivity extends Document {
  title: string;
  category: string;
  location: string;
  description: string;
  host: Types.ObjectId;
  participants: Types.ObjectId[];
  date: Date;
}

const ActivitySchema = new Schema<IActivity>({
  title: { type: String, required: true },
  category: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  host: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  participants: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  date: { type: Date, default: Date.now },
}, { timestamps: true });

export default model<IActivity>('Activity', ActivitySchema);
