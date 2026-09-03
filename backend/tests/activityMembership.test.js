const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Activity = require('../dist/models/Activity').default;
const {
  addWaitlistedJoin,
  approvalMembershipIssue,
  approvePendingJoin,
  confirmDirectJoin,
  declinePendingJoin,
  membershipState,
} = require('../dist/services/activityMembership');

const id = () => new Types.ObjectId();
const sameId = (first, second) => first?.toString() === second?.toString();
const contains = (items, value) => (items || []).some((item) => sameId(item, value));

class AtomicActivityHarness {
  constructor(activity) {
    this.activity = activity;
    this.queue = Promise.resolve();
  }

  findOneAndUpdate = (filter, update) => {
    const operation = this.queue.then(() => this.apply(filter, update));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  apply(filter, update) {
    const activity = this.activity;
    if (!sameId(activity._id, filter._id)) return null;
    if (filter.host && !sameId(activity.host, filter.host)) return null;
    if (filter.status && !filter.status.$in.includes(activity.status)) return null;
    if (filter.date && !(activity.date > filter.date.$gt)) return null;

    const isPipeline = Array.isArray(update);
    const isDecline = isPipeline && Boolean(update[0].$set.declinedParticipants?.$setUnion);
    const isApproval = isPipeline && !isDecline && filter.pendingParticipants instanceof Types.ObjectId;
    const userId = (isApproval || isDecline) ? filter.pendingParticipants : filter.participants?.$ne;
    if ((isApproval || isDecline) && !contains(activity.pendingParticipants, userId)) return null;
    if (filter.participants?.$ne && contains(activity.participants, filter.participants.$ne)) return null;
    if (filter.pendingParticipants?.$ne && contains(activity.pendingParticipants, filter.pendingParticipants.$ne)) return null;
    if (filter.declinedParticipants?.$ne && contains(activity.declinedParticipants, filter.declinedParticipants.$ne)) return null;
    if (filter.waitlist?.$ne && contains(activity.waitlist, filter.waitlist.$ne)) return null;

    const atCapacity = Boolean(activity.maxAttendees && activity.participants.length >= activity.maxAttendees);
    if (isPipeline && !isDecline && atCapacity) return null;
    if (update.$addToSet?.waitlist && !atCapacity) return null;
    if (update.$addToSet?.pendingParticipants && atCapacity) return null;

    if (isDecline) {
      activity.pendingParticipants = activity.pendingParticipants.filter((item) => !sameId(item, userId));
      activity.waitlist = activity.waitlist.filter((item) => !sameId(item, userId));
      activity.invitedUsers = activity.invitedUsers.filter((item) => !sameId(item, userId));
      if (!contains(activity.declinedParticipants, userId)) activity.declinedParticipants.push(userId);
    } else if (isPipeline) {
      if (!contains(activity.participants, userId)) activity.participants.push(userId);
      for (const field of ['pendingParticipants', 'declinedParticipants', 'waitlist', 'invitedUsers']) {
        activity[field] = (activity[field] || []).filter((item) => !sameId(item, userId));
      }
      activity.status = activity.maxAttendees && activity.participants.length >= activity.maxAttendees ? 'full' : 'active';
    } else if (update.$addToSet?.pendingParticipants) {
      const pendingId = update.$addToSet.pendingParticipants;
      if (!contains(activity.pendingParticipants, pendingId)) activity.pendingParticipants.push(pendingId);
    } else if (update.$addToSet?.waitlist) {
      const waitlistId = update.$addToSet.waitlist;
      if (!contains(activity.waitlist, waitlistId)) activity.waitlist.push(waitlistId);
      activity.status = 'full';
    }
    return activity;
  }
}

const future = () => new Date(Date.now() + 60_000);
const activity = ({ capacity = 10, participants = [], pending = [], status = 'active', date = future() } = {}) => ({
  _id: id(),
  host: participants[0] || id(),
  maxAttendees: capacity,
  participants: [...participants],
  pendingParticipants: [...pending],
  declinedParticipants: [],
  waitlist: [],
  invitedUsers: [],
  status,
  date,
});

const withHarness = async (document, test) => {
  const harness = new AtomicActivityHarness(document);
  const original = Activity.findOneAndUpdate;
  Activity.findOneAndUpdate = harness.findOneAndUpdate;
  try {
    await test(document);
  } finally {
    Activity.findOneAndUpdate = original;
  }
};

(async () => {
  const host = id();

  await withHarness(activity({ participants: [host, id(), id(), id(), id()] }), async (document) => {
    const user = id();
    assert.ok(await confirmDirectJoin(document._id.toString(), user.toString(), {}));
    assert.equal(document.participants.length, 6);
  });

  await withHarness(activity({ participants: [host, ...Array.from({ length: 8 }, id)] }), async (document) => {
    assert.ok(await confirmDirectJoin(document._id.toString(), id().toString(), {}));
    assert.equal(document.participants.length, 10);
    assert.equal(document.status, 'full');
  });

  await withHarness(activity({ participants: [host, ...Array.from({ length: 8 }, id)] }), async (document) => {
    const users = [id(), id()];
    const results = await Promise.all(users.map((user) => confirmDirectJoin(document._id.toString(), user.toString(), {})));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(document.participants.length, 10);
    const loser = users[results[0] ? 1 : 0];
    assert.ok(await addWaitlistedJoin(document._id.toString(), loser.toString(), {}));
    assert.equal(contains(document.waitlist, loser), true);
    assert.equal(contains(document.participants, loser), false);
  });

  await withHarness(activity({ participants: [host, id(), id(), id(), id()] }), async (document) => {
    const user = id();
    const results = await Promise.all([
      confirmDirectJoin(document._id.toString(), user.toString(), {}),
      confirmDirectJoin(document._id.toString(), user.toString(), {}),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(document.participants.filter((item) => sameId(item, user)).length, 1);
  });

  await withHarness(activity({ participants: [host], pending: [id()] }), async (document) => {
    const user = document.pendingParticipants[0];
    document.declinedParticipants.push(user);
    document.waitlist.push(user);
    assert.ok(await approvePendingJoin(document._id.toString(), user.toString(), host.toString()));
    assert.equal(membershipState(document, user.toString()), 'participant');
    assert.equal(contains(document.pendingParticipants, user), false);
    assert.equal(contains(document.declinedParticipants, user), false);
    assert.equal(contains(document.waitlist, user), false);
  });

  await withHarness(activity({ participants: [host, ...Array.from({ length: 8 }, id)], pending: [id(), id()] }), async (document) => {
    const pending = [...document.pendingParticipants];
    const results = await Promise.all(pending.map((user) => approvePendingJoin(document._id.toString(), user.toString(), host.toString())));
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(document.participants.length, 10);
    assert.equal(document.pendingParticipants.length, 1);
  });

  await withHarness(activity({ participants: [host], pending: [id()] }), async (document) => {
    const user = document.pendingParticipants[0];
    const results = await Promise.all([
      approvePendingJoin(document._id.toString(), user.toString(), host.toString()),
      declinePendingJoin(document._id.toString(), user.toString(), host.toString()),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    const finalState = membershipState(document, user.toString());
    assert.ok(finalState === 'participant' || finalState === 'declined');
  });

  const validationActivity = activity({ participants: [host], pending: [id()] });
  assert.equal(approvalMembershipIssue(validationActivity, id().toString(), true), 'not_pending');
  assert.equal(approvalMembershipIssue(validationActivity, validationActivity.pendingParticipants[0].toString(), false), 'user_not_found');

  for (const closed of [
    activity({ participants: [host], status: 'cancelled' }),
    activity({ participants: [host], status: 'completed' }),
    activity({ participants: [host], date: new Date(Date.now() - 1) }),
  ]) {
    await withHarness(closed, async (document) => {
      assert.equal(await confirmDirectJoin(document._id.toString(), id().toString(), {}), null);
    });
  }

  console.log('Atomic activity membership concurrency tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
