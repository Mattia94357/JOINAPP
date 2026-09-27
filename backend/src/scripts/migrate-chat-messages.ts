import connectDb from '../config/db';
import Chat from '../models/Chat';
import ChatMessage from '../models/ChatMessage';
import { migrateLegacyMessagesForChat } from '../services/chatMessages';

const run = async () => {
  await connectDb();
  await ChatMessage.init();
  const cursor = Chat.find({ 'messages.0': { $exists: true } }).select('_id').cursor();
  let migrated = 0;
  for await (const chat of cursor) { await migrateLegacyMessagesForChat(chat.id); migrated += 1; }
  console.log(`Migrated ${migrated} chats. Safe to run again.`);
  process.exit(0);
};
run().catch((error) => { console.error('[chat-migration] Failed', { errorName: error instanceof Error ? error.name : 'UnknownError' }); process.exit(1); });
