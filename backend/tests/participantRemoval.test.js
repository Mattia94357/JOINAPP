const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Activity = require('../dist/models/Activity').default;
const {
  approvePendingJoin,
  confirmDirectJoin,
  removeConfirmedParticipant,
} = require('../dist/services/activityMembership');
const { editUpcomingActivityAtomically } = require('../dist/services/activityEditing');
const { canAccessActivityChat } = require('../dist/services/activityChat');
const { canAccessActivity } = require('../dist/utils/activityPrivacy');

const id = () => new Types.ObjectId();
const sameId = (first, second) => first?.toString() === second?.toString();
const contains = (items, value) => (items || []).some((item) => sameId(item, value));
const unwrap = (value) => value && typeof value === 'object' && Object.hasOwn(value, '$literal') ? value.$literal : value;
const now = new Date('2026-09-14T04:00:00.000Z');
const future = new Date('2026-09-15T04:00:00.000Z');

const makeActivity = ({
  host = id(), participants, pending = [], waitlist = [], declined = [], invited = [],
  capacity = 5, status = 'active', date = future, visibility = 'public',
} = {}) => ({
  _id: id(), host, participants: participants || [host], pendingParticipants: [...pending],
  declinedParticipants: [...declined], waitlist: [...waitlist], invitedUsers: [...invited],
  maxAttendees: capacity, status, date, visibility, title: 'Beach Volleyball',
});

class AtomicRemovalHarness {
  constructor(document) {
    this.document = document;
    this.queue = Promise.resolve();
  }

  findOneAndUpdate = (filter, update) => {
    const operation = this.queue.then(() => this.apply(filter, update));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  apply(filter, update) {
    const document = this.document;
    if (!sameId(document._id, filter._id)) return null;
    if (filter.host instanceof Types.ObjectId && !sameId(document.host, filter.host)) return null;
    if (filter.status && !filter.status.$in.includes(document.status)) return null;
    if (filter.date && !(document.date > filter.date.$gt)) return null;

    const set = Array.isArray(update) ? update[0].$set : undefined;
    const isRemoval = Boolean(set?.participants && !set.pendingParticipants);
    const editableFields = new Set(['title', 'category', 'location', 'locationName', 'latitude', 'longitude', 'isApproximateLocation', 'locationPrivacy', 'description', 'date', 'ageGroup', 'coverImage', 'galleryImages', 'vibe', 'maxAttendees']);
    const isEdit = Boolean(set && Object.keys(set).some((key) => editableFields.has(key)));

    if (isRemoval) {
      const target = filter.participants;
      if (!(target instanceof Types.ObjectId) || !contains(document.participants, target)) return null;
      if (sameId(document.host, target)) return null;
      document.participants = document.participants.filter((member) => !sameId(member, target));
      document.status = document.maxAttendees && document.participants.length >= document.maxAttendees ? 'full' : 'active';
      return document;
    }

    if (isEdit) {
      if (filter.$expr?.$lte && document.participants.length > filter.$expr.$lte[1]) return null;
      for (const [key, value] of Object.entries(set)) {
        if (key !== 'status') document[key] = unwrap(value);
      }
      document.status = document.maxAttendees && document.participants.length >= document.maxAttendees ? 'full' : 'active';
      return document;
    }

    const joiningUser = filter.pendingParticipants instanceof Types.ObjectId
      ? filter.pendingParticipants
      : filter.participants?.$ne;
    if (!joiningUser) return null;
    if (filter.pendingParticipants instanceof Types.ObjectId && !contains(document.pendingParticipants, joiningUser)) return null;
    if (contains(document.participants, joiningUser)) return null;
    if (document.maxAttendees && document.participants.length >= document.maxAttendees) return null;
    document.participants.push(joiningUser);
    document.pendingParticipants = document.pendingParticipants.filter((member) => !sameId(member, joiningUser));
    document.declinedParticipants = document.declinedParticipants.filter((member) => !sameId(member, joiningUser));
    document.waitlist = document.waitlist.filter((member) => !sameId(member, joiningUser));
    document.invitedUsers = document.invitedUsers.filter((member) => !sameId(member, joiningUser));
    document.status = document.maxAttendees && document.participants.length >= document.maxAttendees ? 'full' : 'active';
    return document;
  }
}

const withHarness = async (document, test) => {
  const harness = new AtomicRemovalHarness(document);
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
  const target = id();
  const other = id();
  const waiting = id();

  await withHarness(makeActivity({
    host,
    participants: [host, target, other],
    pending: [id()],
    waitlist: [waiting],
    declined: [id()],
    invited: [id()],
    capacity: 3,
    status: 'full',
  }), async (activity) => {
    const arraysBefore = {
      pending: activity.pendingParticipants.map(String),
      waitlist: activity.waitlist.map(String),
      declined: activity.declinedParticipants.map(String),
      invited: activity.invitedUsers.map(String),
    };
    const storedMessages = [{ author: target, message: 'Existing message' }];
    assert.equal(canAccessActivityChat(activity, target.toString()), true);
    assert.ok(await removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now));
    assert.equal(contains(activity.participants, target), false);
    assert.equal(activity.participants.length, 2);
    assert.equal(activity.status, 'active');
    assert.equal(canAccessActivityChat(activity, target.toString()), false);
    assert.equal(canAccessActivityChat(activity, host.toString()), true);
    assert.equal(canAccessActivityChat(activity, other.toString()), true);
    assert.deepEqual(storedMessages, [{ author: target, message: 'Existing message' }]);
    assert.deepEqual({
      pending: activity.pendingParticipants.map(String),
      waitlist: activity.waitlist.map(String),
      declined: activity.declinedParticipants.map(String),
      invited: activity.invitedUsers.map(String),
    }, arraysBefore);
    assert.equal(contains(activity.waitlist, waiting), true);
    assert.equal(contains(activity.participants, waiting), false);
    assert.equal(contains(activity.participants, host), true);
    assert.equal(sameId(activity.host, host), true);
  });

  await withHarness(makeActivity({ host, participants: [host, target] }), async (activity) => {
    assert.equal(await removeConfirmedParticipant(activity._id.toString(), target.toString(), other.toString(), now), null);
    assert.equal(await removeConfirmedParticipant(activity._id.toString(), host.toString(), host.toString(), now), null);
    assert.equal(activity.participants.length, 2);
  });

  for (const stateOnlyUser of ['pendingParticipants', 'waitlist', 'declinedParticipants', 'invitedUsers']) {
    const nonParticipant = id();
    const activity = makeActivity({ host });
    activity[stateOnlyUser].push(nonParticipant);
    await withHarness(activity, async (document) => {
      assert.equal(await removeConfirmedParticipant(document._id.toString(), nonParticipant.toString(), host.toString(), now), null);
      assert.equal(contains(document[stateOnlyUser], nonParticipant), true);
    });
  }
  await withHarness(makeActivity({ host }), async (activity) => {
    assert.equal(await removeConfirmedParticipant(activity._id.toString(), id().toString(), host.toString(), now), null);
  });

  for (const closed of [
    makeActivity({ host, participants: [host, target], status: 'completed' }),
    makeActivity({ host, participants: [host, target], status: 'cancelled' }),
    makeActivity({ host, participants: [host, target], date: now }),
  ]) {
    await withHarness(closed, async (activity) => {
      assert.equal(await removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now), null);
      assert.equal(contains(activity.participants, target), true);
    });
  }

  await withHarness(makeActivity({ host, participants: [host, target] }), async (activity) => {
    const results = await Promise.all([
      removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now),
      removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(activity.participants.length, 1);
  });

  await withHarness(makeActivity({ host, participants: [host, target], visibility: 'private' }), async (activity) => {
    assert.equal(canAccessActivity(activity, target.toString()), true);
    await removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now);
    assert.equal(canAccessActivity(activity, target.toString()), false);
  });

  await withHarness(makeActivity({ host, participants: [host, target], invited: [target], visibility: 'private' }), async (activity) => {
    await removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now);
    assert.equal(canAccessActivity(activity, target.toString()), true);
    assert.equal(contains(activity.invitedUsers, target), true);
  });

  await withHarness(makeActivity({ host, participants: [host, target, other], capacity: 4 }), async (activity) => {
    const joining = id();
    const results = await Promise.all([
      removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now),
      confirmDirectJoin(activity._id.toString(), joining.toString(), {}, now),
    ]);
    assert.ok(results.some(Boolean));
    assert.ok(activity.participants.length <= activity.maxAttendees);
  });

  await withHarness(makeActivity({ host, participants: [host, target, other], pending: [waiting], capacity: 4 }), async (activity) => {
    const results = await Promise.all([
      removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now),
      approvePendingJoin(activity._id.toString(), waiting.toString(), host.toString(), now),
    ]);
    assert.ok(results.some(Boolean));
    assert.ok(activity.participants.length <= activity.maxAttendees);
  });

  await withHarness(makeActivity({ host, participants: [host, target, other], capacity: 5 }), async (activity) => {
    const results = await Promise.all([
      removeConfirmedParticipant(activity._id.toString(), target.toString(), host.toString(), now),
      editUpcomingActivityAtomically(activity._id.toString(), host.toString(), { maxAttendees: 2 }, now),
    ]);
    assert.ok(results.some(Boolean));
    assert.ok(activity.participants.length <= activity.maxAttendees);
  });

  console.log('Host participant removal authorization, access, and concurrency tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
