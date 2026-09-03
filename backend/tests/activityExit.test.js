const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Activity = require('../dist/models/Activity').default;
const {
  confirmedActivityMemberIds,
  leaveUpcomingActivity,
  withdrawPendingJoin,
} = require('../dist/services/activityMembership');
const { canAccessActivity } = require('../dist/utils/activityPrivacy');

const id = () => new Types.ObjectId();
const sameId = (first, second) => first?.toString() === second?.toString();
const contains = (items, value) => (items || []).some((item) => sameId(item, value));
const future = () => new Date(Date.now() + 60_000);

const makeActivity = ({
  host = id(), participants, pending = [], waitlist = [], declined = [], invited = [],
  capacity = 5, status = 'active', date = future(), visibility = 'public',
} = {}) => ({
  _id: id(), host, participants: participants || [host], pendingParticipants: [...pending],
  declinedParticipants: [...declined], waitlist: [...waitlist], invitedUsers: [...invited],
  maxAttendees: capacity, status, date, visibility,
});

class AtomicExitHarness {
  constructor(document) {
    this.document = document;
    this.queue = Promise.resolve();
  }

  findOneAndUpdate = (filter) => {
    const operation = this.queue.then(() => this.apply(filter));
    this.queue = operation.then(() => undefined, () => undefined);
    return operation;
  };

  apply(filter) {
    const document = this.document;
    if (!sameId(document._id, filter._id)) return null;
    if (filter.status && !filter.status.$in.includes(document.status)) return null;
    if (filter.date && !(document.date > filter.date.$gt)) return null;
    if (filter.host?.$ne && sameId(document.host, filter.host.$ne)) return null;

    const isLeave = filter.host?.$ne && filter.participants instanceof Types.ObjectId;
    const userId = isLeave ? filter.participants : filter.pendingParticipants;
    if (!userId) return null;
    if (isLeave) {
      if (!contains(document.participants, userId)) return null;
      document.participants = document.participants.filter((member) => !sameId(member, userId));
      document.pendingParticipants = document.pendingParticipants.filter((member) => !sameId(member, userId));
      document.declinedParticipants = document.declinedParticipants.filter((member) => !sameId(member, userId));
      document.waitlist = document.waitlist.filter((member) => !sameId(member, userId));
      document.status = 'active';
      return document;
    }

    if (filter.participants?.$ne && contains(document.participants, filter.participants.$ne)) return null;
    if (!contains(document.pendingParticipants, userId)) return null;
    document.pendingParticipants = document.pendingParticipants.filter((member) => !sameId(member, userId));
    return document;
  }
}

const withHarness = async (document, test) => {
  const harness = new AtomicExitHarness(document);
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
  const participant = id();

  await withHarness(makeActivity({
    host,
    participants: [host, participant],
    pending: [participant],
    waitlist: [participant],
    declined: [participant],
    invited: [participant],
  }), async (document) => {
    assert.ok(await leaveUpcomingActivity(document._id.toString(), participant.toString()));
    assert.equal(contains(document.participants, participant), false);
    assert.equal(contains(document.pendingParticipants, participant), false);
    assert.equal(contains(document.waitlist, participant), false);
    assert.equal(contains(document.declinedParticipants, participant), false);
    assert.equal(contains(document.invitedUsers, participant), true);
    assert.equal(document.participants.length, 1);
  });

  const waitingUser = id();
  await withHarness(makeActivity({ host, participants: [host, participant, id(), id(), id()], waitlist: [waitingUser], status: 'full' }), async (document) => {
    assert.ok(await leaveUpcomingActivity(document._id.toString(), participant.toString()));
    assert.equal(document.status, 'active');
    assert.equal(document.participants.length, 4);
    assert.equal(contains(document.waitlist, waitingUser), true);
    assert.equal(contains(document.participants, waitingUser), false);
  });

  await withHarness(makeActivity({ host, participants: [host, participant] }), async (document) => {
    assert.equal(await leaveUpcomingActivity(document._id.toString(), host.toString()), null);
    assert.equal(await leaveUpcomingActivity(document._id.toString(), id().toString()), null);
  });

  await withHarness(makeActivity({ host, participants: [host, participant] }), async (document) => {
    const results = await Promise.all([
      leaveUpcomingActivity(document._id.toString(), participant.toString()),
      leaveUpcomingActivity(document._id.toString(), participant.toString()),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(document.participants.length, 1);
  });

  for (const closed of [
    makeActivity({ host, participants: [host, participant], status: 'completed' }),
    makeActivity({ host, participants: [host, participant], status: 'cancelled' }),
    makeActivity({ host, participants: [host, participant], date: new Date(Date.now() - 1) }),
  ]) {
    await withHarness(closed, async (document) => {
      assert.equal(await leaveUpcomingActivity(document._id.toString(), participant.toString()), null);
    });
  }

  await withHarness(makeActivity({ host, participants: [host, participant] }), async (document) => {
    assert.ok(confirmedActivityMemberIds(document).includes(participant.toString()));
    await leaveUpcomingActivity(document._id.toString(), participant.toString());
    assert.equal(confirmedActivityMemberIds(document).includes(participant.toString()), false);
  });

  const pending = id();
  await withHarness(makeActivity({ host, pending: [pending] }), async (document) => {
    const participantCount = document.participants.length;
    assert.ok(await withdrawPendingJoin(document._id.toString(), pending.toString()));
    assert.equal(contains(document.pendingParticipants, pending), false);
    assert.equal(document.participants.length, participantCount);
  });

  await withHarness(makeActivity({ host, pending: [pending] }), async (document) => {
    const results = await Promise.all([
      withdrawPendingJoin(document._id.toString(), pending.toString()),
      withdrawPendingJoin(document._id.toString(), pending.toString()),
    ]);
    assert.equal(results.filter(Boolean).length, 1);
    assert.equal(document.pendingParticipants.length, 0);
  });

  await withHarness(makeActivity({ host }), async (document) => {
    assert.equal(await withdrawPendingJoin(document._id.toString(), id().toString()), null);
  });

  await withHarness(makeActivity({ host, pending: [pending], visibility: 'private' }), async (document) => {
    assert.equal(canAccessActivity(document, pending.toString()), true);
    await withdrawPendingJoin(document._id.toString(), pending.toString());
    assert.equal(canAccessActivity(document, pending.toString()), false);
  });

  await withHarness(makeActivity({ host, pending: [pending], invited: [pending], visibility: 'private' }), async (document) => {
    await withdrawPendingJoin(document._id.toString(), pending.toString());
    assert.equal(canAccessActivity(document, pending.toString()), true);
  });

  console.log('Atomic leave and request-withdrawal tests passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
