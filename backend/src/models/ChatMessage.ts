import { Schema, model, Document, Types } from 'mongoose';

export interface IChatMessage extends Document {
  chat: Types.ObjectId;
  sender: Types.ObjectId;
  text: string;
  clientMessageId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<IChatMessage>({
  chat: { type: Schema.Types.ObjectId, ref: 'Chat', required: true },
  sender: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  text: { type: String, required: true, maxlength: 1200 },
  clientMessageId: { type: String, maxlength: 100 },
}, { timestamps: true });

schema.index({ chat: 1, createdAt: -1, _id: -1 });
schema.index({ chat: 1, sender: 1, clientMessageId: 1 }, {
  unique: true,
  partialFilterExpression: { clientMessageId: { $type: 'string' } },
});

export default model<IChatMessage>('ChatMessage', schema);
