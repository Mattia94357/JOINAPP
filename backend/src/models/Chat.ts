import { Schema, model, Document, Types } from 'mongoose';

export interface IMessage {
  author: Types.ObjectId;
  message: string;
  sentAt: Date;
}

export interface IChat extends Document {
  activity: Types.ObjectId | null;
  members: Types.ObjectId[];
  chatType: 'publicActivityChat' | 'privateActivityChat' | 'directPrivateChat';
  messages: IMessage[];
}

const MessageSchema = new Schema<IMessage>({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  sentAt: { type: Date, default: Date.now },
});

const ChatSchema = new Schema<IChat>({
  activity: { type: Schema.Types.ObjectId, ref: 'Activity' },
  members: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  chatType: {
    type: String,
    enum: ['publicActivityChat', 'privateActivityChat', 'directPrivateChat'],
    default: 'publicActivityChat',
  },
  messages: [MessageSchema],
}, { timestamps: true });

export default model<IChat>('Chat', ChatSchema);
