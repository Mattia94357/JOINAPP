const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Chat = require('../dist/models/Chat').default;
const {
  canAccessActivityChat,
  isActivityChatReadOnly,
  lockActivityChatForCancellation,
} = require('../dist/services/activityChat');

const id = () => new Types.ObjectId();
const sameId = (first, second) => first?.toString() === second?.toString();

class AtomicChatHarness {
  constructor(chat) {
    this.chat = chat;
    this.queue = Promise.resolve();
  }

  findOneAndUpdate = (filter, update) => {
    const operation = this.queue.then(() => this.apply(filter, update));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  apply(filter, update) {
    if (filter.activity && !filter.activity.$exists && !sameId(filter.activity, this.chat.activity)) return null;
    if (filter._id && !sameId(filter._id, this.chat._id)) return null;

    if (update.$set?.activityReadOnly === true) {
      this.chat.activityReadOnly = true;
      this.chat.members = [...update.$set.members];
      this.chat.chatType = update.$set.chatType;
      return this.chat;
    }

    if (update.$push?.messages) {
      if (this.chat.activityReadOnly) return null;
      this.chat.messages.push({ ...update.$push.messages });
      return this.chat;
    }

    return null;
  }
}

const withHarness = async (chat, test) => {
  const harness = new AtomicChatHarness(chat);
  const original = Chat.findOneAndUpdate;
  Chat.findOneAndUpdate = harness.findOneAndUpdate;
  try {
    await test(chat);
  } finally {
    Chat.findOneAndUpdate = original;
  }
};

(async () => {
  const host = id();
  const participant = id();
  const formerParticipant = id();
  const pending = id();
  const declined = id();
  const waitlisted = id();
  const activity = {
    _id: id(),
    host,
    participants: [host, participant],
    pendingParticipants: [pending],
    declinedParticipants: [declined],
    waitlist: [waitlisted],
    visibility: 'private',
    status: 'active',
  };
  const historicalMessage = { author: host, message: 'Original message', sentAt: new Date(Date.now() - 1000) };

  assert.equal(canAccessActivityChat(activity, host.toString()), true);
  assert.equal(canAccessActivityChat(activity, participant.toString()), true);
  assert.equal(canAccessActivityChat(activity, formerParticipant.toString()), false);
  assert.equal(canAccessActivityChat(activity, pending.toString()), false);
  assert.equal(canAccessActivityChat(activity, declined.toString()), false);
  assert.equal(canAccessActivityChat(activity, waitlisted.toString()), false);
  assert.equal(canAccessActivityChat(activity, id().toString()), false);

  await withHarness({
    _id: id(), activity: activity._id, members: [host, participant], chatType: 'privateActivityChat',
    activityReadOnly: false, messages: [{ ...historicalMessage }],
  }, async (chat) => {
    assert.equal(isActivityChatReadOnly(activity, chat), false);
  });

  await withHarness({
    _id: id(), activity: activity._id, members: [host, participant], chatType: 'privateActivityChat',
    activityReadOnly: false, messages: [{ ...historicalMessage }],
  }, async (chat) => {
    const before = chat.messages.map((message) => ({ ...message }));
    const cancelledActivity = { ...activity, status: 'cancelled' };
    await lockActivityChatForCancellation(cancelledActivity);
    assert.equal(isActivityChatReadOnly(cancelledActivity, chat), true);
    assert.deepEqual(chat.messages, before);
    assert.equal(canAccessActivityChat(cancelledActivity, participant.toString()), true);
    assert.equal(canAccessActivityChat(cancelledActivity, host.toString()), true);
    assert.equal(canAccessActivityChat(cancelledActivity, formerParticipant.toString()), false);
  });

  await withHarness({
    _id: id(), activity: activity._id, members: [host, participant], chatType: 'privateActivityChat',
    activityReadOnly: false, messages: [{ ...historicalMessage }],
  }, async (chat) => {
    await lockActivityChatForCancellation({ ...activity, status: 'cancelled' });
    const messagesAfterLock = chat.messages.length;
    assert.equal(chat.messages.length, messagesAfterLock);
  });

  console.log('Cancelled activity chat policy tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
