import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage {
  author: Types.ObjectId;
  message: string;
  sentAt: Date;
}

export interface IChatReadState {
  user: Types.ObjectId;
  lastReadAt: Date;
  lastReadMessageId?: Types.ObjectId;
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
  messages?: IMessage[];
  lastMessageAt?: Date;
}

const MessageSchema = new Schema<IMessage>({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

const ChatReadStateSchema = new Schema<IChatReadState>({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  lastReadAt: { type: Date, default: Date.now },
  lastReadMessageId: { type: Schema.Types.ObjectId, ref: 'ChatMessage' },
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
  // Compatibility only. The migration moves these records to ChatMessage and unsets this field.
  messages: { type: [MessageSchema], default: undefined, select: false },
  lastMessageAt: { type: Date },
}, { timestamps: true });

ChatSchema.index({ activity: 1 }, { unique: true, sparse: true });
ChatSchema.index({ directKey: 1 }, { unique: true, sparse: true });
ChatSchema.index({ members: 1, updatedAt: -1 });
ChatSchema.index({ members: 1, lastMessageAt: -1 });

export default model<IChat>('Chat', ChatSchema);
