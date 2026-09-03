import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage {
  author: Types.ObjectId;
  message: string;
  sentAt: Date;
}

export interface IChatReadState {
  user: Types.ObjectId;
  lastReadAt: Date;
}

export interface IChat extends Document {
  activity?: Types.ObjectId;
  members: Types.ObjectId[];
  chatType: 'publicActivityChat' | 'privateActivityChat' | 'directPrivateChat';
  directKey?: string;
  directState?: 'active' | 'request';
  initiatedBy?: Types.ObjectId;
  requestRecipient?: Types.ObjectId;
  activityReadOnly?: boolean;
  readStates: IChatReadState[];
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

const ChatReadStateSchema = new Schema<IChatReadState>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastReadAt: { type: Date, default: Date.now },
}, { _id: false });

const ChatSchema = new Schema<IChat>({
  activity: { type: Schema.Types.ObjectId, ref: 'Activity' },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  chatType: {
    type: String,
    enum: ['publicActivityChat', 'privateActivityChat', 'directPrivateChat'],
    default: 'publicActivityChat',
  },
  directKey: { type: String },
  directState: { type: String, enum: ['active', 'request'] },
  initiatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  requestRecipient: { type: Schema.Types.ObjectId, ref: 'User' },
  activityReadOnly: { type: Boolean, default: false },
  readStates: { type: [ChatReadStateSchema], default: [] },
  messages: [MessageSchema],
}, { timestamps: true });

ChatSchema.index({ activity: 1 }, { unique: true, sparse: true });
ChatSchema.index({ directKey: 1 }, { unique: true, sparse: true });
ChatSchema.index({ members: 1, updatedAt: -1 });

export default model<IChat>('Chat', ChatSchema);
