const assert = require('node:assert/strict');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { MongoMemoryServer } = require('mongodb-memory-server');
const User = require('../dist/models/User').default;
const Activity = require('../dist/models/Activity').default;
const Chat = require('../dist/models/Chat').default;
const Message = require('../dist/models/ChatMessage').default;
const { errorHandler } = require('../dist/middleware/errorHandler');
const { markMessagesRead } = require('../dist/services/chatMessages');

async function run() {
  process.env.JWT_SECRET = 'messaging-tests-only-secret'; process.env.NODE_ENV = 'production';
  const mongo = await MongoMemoryServer.create(); let server;
  try {
    await mongoose.connect(mongo.getUri()); await Promise.all([User.init(), Activity.init(), Chat.init(), Message.init()]);
    const app = express(); app.set('trust proxy', 1); app.use(express.json());
    app.use('/api/chats', require('../dist/routes/chats').default); app.use(errorHandler);
    server = await new Promise((resolve) => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
    let seq = 0;
    const call = async (user, path, method = 'GET', body) => {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api${path}`, { method,
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.2.0.${++seq}`,
          Authorization: `Bearer ${jwt.sign({ userId: user.id }, process.env.JWT_SECRET)}` },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(10000) });
      return { status: response.status, data: await response.json() };
    };
    const makeUser = (email) => User.create({ name: 'Same Name', email, password: 'test', profileCompleted: true, profilePictureUrl: `https://example.test/${email}.jpg` });
    const [first, second, third] = await Promise.all(['same1@test', 'same2@test', 'third@test'].map(makeUser));
    const activity = await Activity.create({ title: 'Chat test', category: 'Outdoors', location: 'Perth', description: 'Chat test activity',
      host: first._id, participants: [first._id, second._id], date: new Date(Date.now() + 86400000) });
    const opened = await call(first, `/chats/${activity.id}`);
    assert.equal(opened.status, 200); const chatId = opened.data.id;

    const stamp = new Date('2026-09-26T01:02:03.000Z');
    const docs = [];
    for (let index = 0; index < 7; index++) docs.push(await Message.create({ chat: chatId,
      sender: index % 2 ? second._id : first._id, text: `equal-${index}`, createdAt: stamp, updatedAt: stamp }));
    let cursor; const seen = [];
    do {
      const page = await call(first, `/chats/${chatId}?limit=2${cursor ? `&before=${encodeURIComponent(cursor)}` : ''}`);
      assert.equal(page.status, 200); seen.unshift(...page.data.messages.map((message) => message.id));
      cursor = page.data.nextCursor;
      if (!page.data.hasMore) break;
    } while (cursor);
    assert.equal(seen.length, 7); assert.equal(new Set(seen).size, 7);
    assert.deepEqual(new Set(seen), new Set(docs.map((doc) => doc.id)));
    const latest = await call(first, `/chats/${chatId}?limit=20`);
    const fromFirst = latest.data.messages.find((message) => message.sender.id === first.id);
    const fromSecond = latest.data.messages.find((message) => message.sender.id === second.id);
    assert.equal(fromFirst.sender.name, fromSecond.sender.name);
    assert.notEqual(fromFirst.sender.id, fromSecond.sender.id);

    await Chat.updateOne({ _id: chatId, 'readStates.user': second._id }, { $set: { 'readStates.$.lastReadAt': new Date(0) }, $unset: { 'readStates.$.lastReadMessageId': 1 } });
    let counts = await call(second, '/chats/unread-count');
    assert.equal(counts.data.unreadConversationCount, 1);
    const conversation = (await call(second, '/chats')).data.conversations.find((item) => item.id === chatId);
    assert.equal(conversation.unreadCount, 4, 'own messages do not count as unread');
    const readBefore = (await Chat.findById(chatId)).readStates.find((state) => state.user.equals(second._id)).lastReadAt;
    const originalFind = Message.find;
    try {
      Message.find = () => { throw new Error('simulated retrieval failure'); };
      assert.equal((await call(second, `/chats/${chatId}`)).status, 500);
    } finally { Message.find = originalFind; }
    const readAfterFailure = (await Chat.findById(chatId)).readStates.find((state) => state.user.equals(second._id)).lastReadAt;
    assert.equal(readAfterFailure.getTime(), readBefore.getTime());
    assert.equal((await call(second, `/chats/${chatId}`)).status, 200);
    counts = await call(second, '/chats/unread-count'); assert.equal(counts.data.unreadConversationCount, 0);
    await markMessagesRead(chatId, second.id, docs[0]);
    const stableRead = (await Chat.findById(chatId)).readStates.find((state) => state.user.equals(second._id));
    assert.equal(stableRead.lastReadMessageId.toString(), docs[6].id, 'stale read completion cannot move cursor backwards');

    const sendBody = { message: 'retry-safe', clientMessageId: 'fixed-client-message-id' };
    const sent = await Promise.all([call(first, `/chats/${chatId}/message`, 'POST', sendBody), call(first, `/chats/${chatId}/message`, 'POST', sendBody)]);
    assert.ok(sent.every((result) => result.status === 200));
    assert.equal(await Message.countDocuments({ chat: chatId, sender: first._id, clientMessageId: sendBody.clientMessageId }), 1);
    assert.deepEqual(Object.keys(sent[0].data), ['message']);
    assert.deepEqual(Object.keys(sent[0].data.message).sort(), ['createdAt', 'id', 'sender', 'text']);

    const raceActivity = await Activity.create({ title: 'Race', category: 'Outdoors', location: 'Perth', description: 'Race test',
      host: first._id, participants: [first._id, third._id], date: new Date(Date.now() + 86400000) });
    const raceChat = (await call(first, `/chats/${raceActivity.id}`)).data.id;
    const originalCreate = Message.create;
    try {
      Message.create = async (...args) => { const created = await originalCreate.apply(Message, args);
        await Activity.updateOne({ _id: raceActivity._id }, { $pull: { participants: third._id } }); return created; };
      const raced = await call(third, `/chats/${raceChat}/message`, 'POST', { message: 'must disappear', clientMessageId: 'race-message-id' });
      assert.equal(raced.status, 409);
    } finally { Message.create = originalCreate; }
    assert.equal(await Message.countDocuments({ chat: raceChat, text: 'must disappear' }), 0);
    await Activity.updateOne({ _id: raceActivity._id }, { $set: { status: 'cancelled' } });
    const cancelledSend = await call(first, `/chats/${raceChat}/message`, 'POST', { message: 'after cancellation', clientMessageId: 'cancelled-message-id' });
    assert.equal(cancelledSend.status, 409);
    assert.equal(await Message.countDocuments({ chat: raceChat, text: 'after cancellation' }), 0);

    const legacyChat = await Chat.create({ members: [first._id, second._id], chatType: 'directPrivateChat', directKey: `${first.id}:${second.id}`,
      messages: [{ author: first._id, message: 'legacy survives', sentAt: new Date('2025-01-01') }] });
    const legacy = await call(first, `/chats/${legacyChat.id}`);
    assert.equal(legacy.status, 200, JSON.stringify(legacy.data));
    assert.equal(legacy.data.messages[0].text, 'legacy survives');
    assert.equal((await Chat.findById(legacyChat.id).select('+messages')).messages, undefined);
    assert.equal(await Message.countDocuments({ chat: legacyChat._id }), 1);

    await User.updateOne({ _id: first._id }, { $addToSet: { blockedUsers: second._id } });
    const list = await call(second, '/chats');
    assert.ok(!list.data.conversations.some((chat) => chat.id === legacyChat.id));
    console.log('Messaging reliability tests passed: IDs, cursors, read state, bounded/idempotent send, race, unread, blocking, legacy migration.');
  } finally { if (server) await new Promise((resolve) => server.close(resolve)); await mongoose.disconnect(); await mongo.stop(); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
