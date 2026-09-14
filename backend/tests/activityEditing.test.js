const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Activity = require('../dist/models/Activity').default;
const {
  activityEditEligibilityIssue,
  editUpcomingActivityAtomically,
  parseActivityEdit,
} = require('../dist/services/activityEditing');
const { approvePendingJoin, confirmDirectJoin } = require('../dist/services/activityMembership');

const id = () => new Types.ObjectId();
const sameId = (first, second) => first?.toString() === second?.toString();
const unwrap = (value) => value && typeof value === 'object' && Object.hasOwn(value, '$literal') ? value.$literal : value;

class EditMembershipHarness {
  constructor(activity) { this.activity = activity; this.queue = Promise.resolve(); }
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

    const set = Array.isArray(update) ? update[0].$set : undefined;
    const editFields = new Set(['title', 'category', 'location', 'locationName', 'latitude', 'longitude', 'isApproximateLocation', 'locationPrivacy', 'description', 'date', 'ageGroup', 'coverImage', 'galleryImages', 'vibe', 'maxAttendees']);
    const isEdit = Boolean(set && Object.keys(set).some((key) => editFields.has(key)));
    if (isEdit) {
      if (filter.$expr && activity.participants.length > filter.$expr.$lte[1]) return null;
      for (const [key, value] of Object.entries(set)) {
        if (key !== 'status') activity[key] = unwrap(value);
      }
      activity.status = activity.maxAttendees && activity.participants.length >= activity.maxAttendees ? 'full' : 'active';
      return activity;
    }

    const joiningUser = filter.pendingParticipants instanceof Types.ObjectId
      ? filter.pendingParticipants
      : filter.participants?.$ne;
    if (!joiningUser) return null;
    if (filter.pendingParticipants instanceof Types.ObjectId
      && !(activity.pendingParticipants || []).some((member) => sameId(member, joiningUser))) return null;
    if ((activity.participants || []).some((member) => sameId(member, joiningUser))) return null;
    if (activity.maxAttendees && activity.participants.length >= activity.maxAttendees) return null;
    activity.participants.push(joiningUser);
    activity.pendingParticipants = (activity.pendingParticipants || []).filter((member) => !sameId(member, joiningUser));
    activity.status = activity.maxAttendees && activity.participants.length >= activity.maxAttendees ? 'full' : 'active';
    return activity;
  }
}

const now = new Date('2026-09-06T04:00:00.000Z');
const future = new Date('2026-09-07T04:00:00.000Z');
const createActivity = ({ participantCount = 2, capacity = 8, status = 'active', date = future } = {}) => {
  const host = id();
  return {
    _id: id(), host, title: 'Original activity', description: 'An original activity description.',
    category: 'Outdoors', location: 'Perth', locationName: 'Meeting point', latitude: -31.95,
    longitude: 115.86, locationPrivacy: 'public', isApproximateLocation: false,
    date, maxAttendees: capacity, status, visibility: 'private', joinApproval: 'manual',
    inviteCode: 'preserved-code', participants: [host, ...Array.from({ length: participantCount - 1 }, id)],
    pendingParticipants: [], declinedParticipants: [], waitlist: [], invitedUsers: [id()],
  };
};

const withHarness = async (activity, test) => {
  const original = Activity.findOneAndUpdate;
  Activity.findOneAndUpdate = new EditMembershipHarness(activity).findOneAndUpdate;
  try { await test(activity); } finally { Activity.findOneAndUpdate = original; }
};

(async () => {
  const parsed = parseActivityEdit({
    title: '  Updated activity  ', date: future.toISOString(), maxAttendees: 10,
    latitude: -20.31, longitude: 118.60, galleryImages: ['https://example.com/photo.jpg'],
  }, now);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.update.title, 'Updated activity');
  assert.equal(parsed.update.date.toISOString(), future.toISOString());

  for (const protectedField of ['host', 'participants', 'pendingParticipants', 'status', 'visibility', 'joinApproval', 'inviteCode', 'activityRating', 'reviewCount']) {
    assert.match(parseActivityEdit({ [protectedField]: 'changed' }, now).error, /cannot be edited/);
  }
  for (const unsupportedCreationField of ['venueName', 'exactAddress', 'startTime', 'endTime', 'costType', 'hostNote', 'cancellationPolicy']) {
    assert.match(parseActivityEdit({ [unsupportedCreationField]: 'changed' }, now).error, /cannot be edited/);
  }
  assert.match(parseActivityEdit({ date: now.toISOString() }, now).error, /future/);
  assert.match(parseActivityEdit({ date: new Date(now.getTime() - 1).toISOString() }, now).error, /future/);
  assert.match(parseActivityEdit({ date: 'not-a-date' }, now).error, /future/);
  assert.match(parseActivityEdit({ latitude: -20 }, now).error, /Both latitude/);
  assert.match(parseActivityEdit({ galleryImages: Array(6).fill('https://example.com/a.jpg') }, now).error, /up to 5/);

  const eligible = createActivity();
  assert.equal(activityEditEligibilityIssue(eligible, eligible.host.toString(), { title: 'Changed title' }, now), undefined);
  const participant = eligible.participants[1];
  const pendingUser = id();
  const waitlistedUser = id();
  const declinedUser = id();
  const invitedUser = id();
  eligible.pendingParticipants.push(pendingUser);
  eligible.waitlist.push(waitlistedUser);
  eligible.declinedParticipants.push(declinedUser);
  eligible.invitedUsers.push(invitedUser);
  for (const nonHost of [participant, pendingUser, waitlistedUser, declinedUser, invitedUser, id()]) {
    assert.equal(activityEditEligibilityIssue(eligible, nonHost.toString(), {}, now), 'not_host');
  }
  assert.equal(activityEditEligibilityIssue({ ...eligible, status: 'cancelled' }, eligible.host.toString(), {}, now), 'cancelled');
  assert.equal(activityEditEligibilityIssue({ ...eligible, status: 'completed' }, eligible.host.toString(), {}, now), 'completed');
  assert.equal(activityEditEligibilityIssue({ ...eligible, date: now }, eligible.host.toString(), {}, now), 'started');
  assert.equal(activityEditEligibilityIssue(eligible, eligible.host.toString(), { maxAttendees: 1 }, now), 'capacity_below_members');

  await withHarness(createActivity({ participantCount: 3 }), async (activity) => {
    activity.pendingParticipants.push(id());
    activity.declinedParticipants.push(id());
    activity.waitlist.push(id());
    const protectedSnapshot = {
      id: activity._id.toString(), host: activity.host.toString(), participants: activity.participants.map(String),
      pendingParticipants: [...activity.pendingParticipants], visibility: activity.visibility,
      joinApproval: activity.joinApproval, inviteCode: activity.inviteCode, invitedUsers: activity.invitedUsers.map(String),
    };
    assert.ok(await editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), {
      title: 'Atomic updated activity', maxAttendees: 3, locationPrivacy: 'approximate',
    }, now));
    assert.equal(activity.title, 'Atomic updated activity');
    assert.equal(activity.maxAttendees, 3);
    assert.equal(activity.status, 'full');
    assert.deepEqual({
      id: activity._id.toString(), host: activity.host.toString(), participants: activity.participants.map(String),
      pendingParticipants: [...activity.pendingParticipants], visibility: activity.visibility,
      joinApproval: activity.joinApproval, inviteCode: activity.inviteCode, invitedUsers: activity.invitedUsers.map(String),
    }, protectedSnapshot);
  });

  await withHarness(createActivity({ participantCount: 3, capacity: 8 }), async (activity) => {
    assert.ok(await editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { maxAttendees: 5 }, now));
    assert.equal(activity.maxAttendees, 5);
    assert.equal(activity.status, 'active');
  });

  await withHarness(createActivity(), async (activity) => {
    const movedDate = new Date('2026-09-08T05:00:00.000Z');
    assert.ok(await editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { date: movedDate }, now));
    assert.equal(activity.date.toISOString(), movedDate.toISOString());
  });

  await withHarness(createActivity({ participantCount: 4, capacity: 8 }), async (activity) => {
    assert.equal(await editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { maxAttendees: 3 }, now), null);
    assert.equal(activity.maxAttendees, 8);
  });

  await withHarness(createActivity({ participantCount: 3, capacity: 3, status: 'full' }), async (activity) => {
    assert.ok(await editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { maxAttendees: 5 }, now));
    assert.equal(activity.maxAttendees, 5);
    assert.equal(activity.status, 'active');
  });

  await withHarness(createActivity(), async (activity) => {
    assert.equal(await editUpcomingActivityAtomically(activity._id.toString(), id().toString(), { title: 'Unauthorized edit' }, now), null);
    assert.equal(activity.title, 'Original activity');
  });

  for (const status of ['cancelled', 'completed']) {
    await withHarness(createActivity({ status }), async (activity) => {
      assert.equal(await editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { title: 'Blocked edit' }, now), null);
    });
  }
  await withHarness(createActivity({ date: now }), async (activity) => {
    assert.equal(await editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { title: 'Blocked edit' }, now), null);
  });

  await withHarness(createActivity({ participantCount: 4, capacity: 6 }), async (activity) => {
    const joining = id();
    const results = await Promise.all([
      editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { maxAttendees: 4 }, now),
      confirmDirectJoin(activity._id.toString(), joining.toString(), {}, now),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.ok(activity.participants.length <= activity.maxAttendees);
  });

  await withHarness(createActivity({ participantCount: 4, capacity: 6 }), async (activity) => {
    const pending = id();
    activity.pendingParticipants.push(pending);
    const results = await Promise.all([
      approvePendingJoin(activity._id.toString(), pending.toString(), activity.host.toString(), now),
      editUpcomingActivityAtomically(activity._id.toString(), activity.host.toString(), { maxAttendees: 4 }, now),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.ok(activity.participants.length <= activity.maxAttendees);
  });

  console.log('Host activity edit validation and atomic capacity tests passed.');
})().catch((error) => { console.error(error); process.exitCode = 1; });
