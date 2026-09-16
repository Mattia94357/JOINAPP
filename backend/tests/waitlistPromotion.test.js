const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Activity = require('../dist/models/Activity').default;
const User = require('../dist/models/User').default;
const {
  activityViewerJoinStatus,
  approvePendingJoin,
  confirmDirectJoin,
  leaveUpcomingActivity,
  promoteActivityWaitlist,
  removeConfirmedParticipant,
} = require('../dist/services/activityMembership');
const { editUpcomingActivityAtomically } = require('../dist/services/activityEditing');
const { canAccessActivityChat } = require('../dist/services/activityChat');
const { canAccessActivity } = require('../dist/utils/activityPrivacy');

const id = () => new Types.ObjectId();
const sameId = (first, second) => first?.toString() === second?.toString();
const contains = (items, value) => (items || []).some((item) => sameId(item, value));
const remove = (items, value) => (items || []).filter((item) => !sameId(item, value));
const unwrap = (value) => value && typeof value === 'object' && Object.hasOwn(value, '$literal') ? value.$literal : value;
const now = new Date('2026-09-16T04:00:00.000Z');
const future = new Date('2026-09-17T04:00:00.000Z');

const makeActivity = ({
  host = id(), participants, pending = [], waitlist = [], declined = [], invited = [],
  capacity = 4, status = 'active', date = future, visibility = 'public',
} = {}) => ({
  _id: id(), host, participants: participants || [host], pendingParticipants: [...pending],
  declinedParticipants: [...declined], waitlist: [...waitlist], invitedUsers: [...invited],
  maxAttendees: capacity, status, date, visibility, title: 'FIFO activity',
});

class WaitlistHarness {
  constructor(document, missingUsers = []) {
    this.document = document;
    this.missingUsers = new Set(missingUsers.map(String));
    this.queue = Promise.resolve();
  }

  findById = async (activityId) => sameId(this.document._id, activityId) ? this.document : null;
  userExists = async ({ _id }) => this.missingUsers.has(String(_id)) ? null : { _id };
  findOneAndUpdate = (filter, update) => {
    const operation = this.queue.then(() => this.apply(filter, update));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  matches(filter) {
    const activity = this.document;
    if (!sameId(activity._id, filter._id)) return false;
    if (filter.status && !filter.status.$in.includes(activity.status)) return false;
    if (filter.date && !(activity.date > filter.date.$gt)) return false;
    if (filter.host instanceof Types.ObjectId && !sameId(activity.host, filter.host)) return false;
    if (filter.host?.$ne && sameId(activity.host, filter.host.$ne)) return false;
    if (filter['waitlist.0'] && !sameId(activity.waitlist[0], filter['waitlist.0'])) return false;
    if (filter.participants instanceof Types.ObjectId && !contains(activity.participants, filter.participants)) return false;
    if (filter.participants?.$ne && contains(activity.participants, filter.participants.$ne)) return false;
    if (filter.pendingParticipants instanceof Types.ObjectId && !contains(activity.pendingParticipants, filter.pendingParticipants)) return false;
    if (filter.pendingParticipants?.$ne && contains(activity.pendingParticipants, filter.pendingParticipants.$ne)) return false;
    if (filter.declinedParticipants?.$ne && contains(activity.declinedParticipants, filter.declinedParticipants.$ne)) return false;
    if (filter.$expr) {
      if (filter.$expr.$lte && activity.participants.length > filter.$expr.$lte[1]) return false;
      if ((filter.$expr.$or || filter.$expr.$and) && activity.maxAttendees && activity.participants.length >= activity.maxAttendees) return false;
    }
    return true;
  }

  apply(filter, update) {
    if (!this.matches(filter)) return null;
    const activity = this.document;

    if (!Array.isArray(update) && update.$pull?.waitlist) {
      activity.waitlist = remove(activity.waitlist, update.$pull.waitlist);
      return activity;
    }

    const set = Array.isArray(update) ? update[0].$set : undefined;
    const isLeave = filter.host?.$ne && filter.participants instanceof Types.ObjectId;
    const isRemoval = filter.host instanceof Types.ObjectId && filter.participants instanceof Types.ObjectId && !filter['waitlist.0'];
    const editableFields = new Set(['title', 'category', 'location', 'locationName', 'latitude', 'longitude', 'isApproximateLocation', 'locationPrivacy', 'description', 'date', 'ageGroup', 'coverImage', 'galleryImages', 'vibe', 'maxAttendees']);
    const isEdit = Boolean(set && Object.keys(set).some((key) => editableFields.has(key)));

    if (isLeave || isRemoval) {
      const target = filter.participants;
      activity.participants = remove(activity.participants, target);
      if (isLeave) {
        activity.pendingParticipants = remove(activity.pendingParticipants, target);
        activity.declinedParticipants = remove(activity.declinedParticipants, target);
        activity.waitlist = remove(activity.waitlist, target);
      }
      activity.status = activity.maxAttendees && activity.participants.length >= activity.maxAttendees ? 'full' : 'active';
      return activity;
    }

    if (isEdit) {
      for (const [key, value] of Object.entries(set)) {
        if (key !== 'status') activity[key] = unwrap(value);
      }
      activity.status = activity.maxAttendees && activity.participants.length >= activity.maxAttendees ? 'full' : 'active';
      return activity;
    }

    const candidate = filter['waitlist.0']
      || (filter.pendingParticipants instanceof Types.ObjectId ? filter.pendingParticipants : filter.participants?.$ne);
    if (!candidate || contains(activity.participants, candidate)) return null;
    if (filter['waitlist.0'] && !sameId(activity.waitlist[0], candidate)) return null;
    if (activity.maxAttendees && activity.participants.length >= activity.maxAttendees) return null;
    activity.participants.push(candidate);
    activity.pendingParticipants = remove(activity.pendingParticipants, candidate);
    activity.declinedParticipants = remove(activity.declinedParticipants, candidate);
    activity.waitlist = remove(activity.waitlist, candidate);
    activity.invitedUsers = remove(activity.invitedUsers, candidate);
    activity.status = activity.maxAttendees && activity.participants.length >= activity.maxAttendees ? 'full' : 'active';
    return activity;
  }
}

const withHarness = async (activity, test, missingUsers = []) => {
  const harness = new WaitlistHarness(activity, missingUsers);
  const originalFindById = Activity.findById;
  const originalFindOneAndUpdate = Activity.findOneAndUpdate;
  const originalUserExists = User.exists;
  Activity.findById = harness.findById;
  Activity.findOneAndUpdate = harness.findOneAndUpdate;
  User.exists = harness.userExists;
  try {
    await test(activity);
  } finally {
    Activity.findById = originalFindById;
    Activity.findOneAndUpdate = originalFindOneAndUpdate;
    User.exists = originalUserExists;
  }
};

(async () => {
  const host = id();
  const leaving = id();
  const other = id();
  const first = id();
  const second = id();
  const third = id();

  await withHarness(makeActivity({ host, participants: [host, leaving, other], waitlist: [first, second], capacity: 3, status: 'full' }), async (activity) => {
    assert.ok(await leaveUpcomingActivity(activity._id.toString(), leaving.toString(), now));
    const result = await promoteActivityWaitlist(activity._id.toString(), now);
    assert.deepEqual(result.promotedUserIds, [first.toString()]);
    assert.equal(contains(activity.participants, first), true);
    assert.equal(contains(activity.participants, second), false);
    assert.deepEqual(activity.waitlist.map(String), [second.toString()]);
    assert.equal(activity.status, 'full');
  });

  await withHarness(makeActivity({ host, participants: [host, other], waitlist: [first, second, third], capacity: 4 }), async (activity) => {
    const result = await promoteActivityWaitlist(activity._id.toString(), now);
    assert.deepEqual(result.promotedUserIds, [first.toString(), second.toString()]);
    assert.deepEqual(activity.waitlist.map(String), [third.toString()]);
    assert.equal(activity.participants.length, 4);
    assert.equal(activity.status, 'full');
  });

  await withHarness(makeActivity({ host, participants: [host, leaving, other], waitlist: [first], capacity: 3, status: 'full' }), async (activity) => {
    assert.ok(await removeConfirmedParticipant(activity._id.toString(), leaving.toString(), host.toString(), now));
    await promoteActivityWaitlist(activity._id.toString(), now);
    assert.equal(contains(activity.participants, leaving), false);
    assert.equal(contains(activity.participants, first), true);
  });

  await withHarness(makeActivity({ host, participants: [host, leaving, other], waitlist: [first, second], capacity: 3, status: 'full' }), async (activity) => {
    assert.ok(await editUpcomingActivityAtomically(activity._id.toString(), host.toString(), { maxAttendees: 5 }, now));
    const result = await promoteActivityWaitlist(activity._id.toString(), now);
    assert.deepEqual(result.promotedUserIds, [first.toString(), second.toString()]);
    assert.equal(activity.participants.length, 5);
    assert.equal(activity.status, 'full');
  });

  await withHarness(makeActivity({ host, participants: [host, leaving, other], waitlist: [first, second], capacity: 3, status: 'full' }), async (activity) => {
    assert.ok(await editUpcomingActivityAtomically(activity._id.toString(), host.toString(), { maxAttendees: 8 }, now));
    const result = await promoteActivityWaitlist(activity._id.toString(), now);
    assert.deepEqual(result.promotedUserIds, [first.toString(), second.toString()]);
    assert.equal(activity.participants.length, 5);
    assert.equal(activity.status, 'active');
  });

  await withHarness(makeActivity({ host, participants: [host, other], waitlist: [first], capacity: 4 }), async (activity) => {
    assert.ok(await editUpcomingActivityAtomically(activity._id.toString(), host.toString(), { maxAttendees: 2 }, now));
    assert.equal(activity.participants.length, 2);
    assert.deepEqual(activity.waitlist.map(String), [first.toString()]);
  });

  await withHarness(makeActivity({ host, participants: [host, other], waitlist: [first], capacity: 5 }), async (activity) => {
    assert.equal(canAccessActivityChat(activity, first.toString()), false);
    assert.equal(activityViewerJoinStatus(activity, first.toString()), 'waitlisted');
    const result = await promoteActivityWaitlist(activity._id.toString(), now);
    assert.deepEqual(result.promotedUserIds, [first.toString()]);
    assert.equal(canAccessActivityChat(activity, first.toString()), true);
    assert.equal(activityViewerJoinStatus(activity, first.toString()), 'participant');
    assert.equal(activity.status, 'active');
  });

  await withHarness(makeActivity({ host, participants: [host, other], waitlist: [first], invited: [first], capacity: 3, visibility: 'private' }), async (activity) => {
    assert.equal(canAccessActivityChat(activity, first.toString()), false);
    assert.equal(canAccessActivity(activity, first.toString()), true);
    await promoteActivityWaitlist(activity._id.toString(), now);
    assert.equal(canAccessActivityChat(activity, first.toString()), true);
    assert.equal(canAccessActivity(activity, first.toString()), true);
    assert.equal(contains(activity.invitedUsers, first), false);
  });

  for (const closed of [
    makeActivity({ host, participants: [host, other], waitlist: [first], capacity: 3, status: 'cancelled' }),
    makeActivity({ host, participants: [host, other], waitlist: [first], capacity: 3, status: 'completed' }),
    makeActivity({ host, participants: [host, other], waitlist: [first], capacity: 3, date: now }),
  ]) {
    await withHarness(closed, async (activity) => {
      const result = await promoteActivityWaitlist(activity._id.toString(), now);
      assert.deepEqual(result.promotedUserIds, []);
      assert.equal(contains(activity.participants, first), false);
    });
  }

  await withHarness(makeActivity({ host, participants: [host, other], waitlist: [first], capacity: 3 }), async (activity) => {
    const newcomer = id();
    await Promise.all([
      promoteActivityWaitlist(activity._id.toString(), now),
      confirmDirectJoin(activity._id.toString(), newcomer.toString(), {}, now),
    ]);
    assert.ok(activity.participants.length <= activity.maxAttendees);
    assert.equal(contains(activity.participants, first) && contains(activity.participants, newcomer), false);
  });

  await withHarness(makeActivity({ host, participants: [host, other], pending: [third], waitlist: [first], capacity: 3 }), async (activity) => {
    await Promise.all([
      promoteActivityWaitlist(activity._id.toString(), now),
      approvePendingJoin(activity._id.toString(), third.toString(), host.toString(), now),
    ]);
    assert.ok(activity.participants.length <= activity.maxAttendees);
    assert.equal(contains(activity.participants, first) && contains(activity.participants, third), false);
  });

  await withHarness(makeActivity({ host, participants: [host, leaving, other], waitlist: [first, second], capacity: 3, status: 'full' }), async (activity) => {
    await Promise.all([
      (async () => {
        const removed = await removeConfirmedParticipant(activity._id.toString(), leaving.toString(), host.toString(), now);
        if (removed) await promoteActivityWaitlist(activity._id.toString(), now);
      })(),
      promoteActivityWaitlist(activity._id.toString(), now),
    ]);
    assert.ok(activity.participants.length <= activity.maxAttendees);
    assert.equal(new Set(activity.participants.map(String)).size, activity.participants.length);
  });

  await withHarness(makeActivity({ host, participants: [host, other], waitlist: [first, second], capacity: 3 }), async (activity) => {
    await Promise.all([
      promoteActivityWaitlist(activity._id.toString(), now),
      editUpcomingActivityAtomically(activity._id.toString(), host.toString(), { maxAttendees: 2 }, now),
    ]);
    assert.ok(activity.participants.length <= activity.maxAttendees);
  });

  const missing = id();
  const pendingStale = id();
  const declinedStale = id();
  await withHarness(makeActivity({
    host,
    participants: [host, other],
    pending: [pendingStale],
    declined: [declinedStale],
    waitlist: [host, other, pendingStale, declinedStale, missing, first, second],
    capacity: 3,
  }), async (activity) => {
    const result = await promoteActivityWaitlist(activity._id.toString(), now);
    assert.deepEqual(result.promotedUserIds, [first.toString()]);
    assert.deepEqual(activity.waitlist.map(String), [second.toString()]);
    assert.equal(activity.participants.filter((member) => sameId(member, first)).length, 1);
  }, [missing]);

  await withHarness(makeActivity({ host, participants: [host, other], waitlist: [first, first, second], capacity: 4 }), async (activity) => {
    await promoteActivityWaitlist(activity._id.toString(), now);
    assert.equal(activity.participants.filter((member) => sameId(member, first)).length, 1);
    assert.equal(activity.participants.filter((member) => sameId(member, second)).length, 1);
    assert.equal(activity.waitlist.length, 0);
  });

  console.log('FIFO waitlist promotion, access, lifecycle, and concurrency tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
