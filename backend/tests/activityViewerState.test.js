const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const { activityViewerJoinStatus } = require('../dist/services/activityMembership');
const { canAccessActivity } = require('../dist/utils/activityPrivacy');

const id = () => new Types.ObjectId();
const makeActivity = ({ host = id(), participants = [], pending = [], declined = [], waitlist = [], invited = [], visibility = 'public' } = {}) => ({
  host,
  participants,
  pendingParticipants: pending,
  declinedParticipants: declined,
  waitlist,
  invitedUsers: invited,
  visibility,
});

const host = id();
const confirmed = id();
const pending = id();
const declined = id();
const waitlisted = id();
const invited = id();
const unrelated = id();
const activity = makeActivity({
  host,
  participants: [host, confirmed],
  pending: [pending],
  declined: [declined],
  waitlist: [waitlisted],
  invited: [invited],
});

assert.equal(activityViewerJoinStatus(activity, host.toString()), 'host');
assert.equal(activityViewerJoinStatus(activity, confirmed.toString()), 'participant');
assert.equal(activityViewerJoinStatus(activity, pending.toString()), 'pending');
assert.equal(activityViewerJoinStatus(activity, pending.toString()), 'pending', 'refresh preserves pending state');
assert.equal(activityViewerJoinStatus(activity, waitlisted.toString()), 'waitlisted');
assert.equal(activityViewerJoinStatus(activity, declined.toString()), 'declined');
assert.equal(activityViewerJoinStatus(activity, invited.toString()), 'invited');
assert.equal(activityViewerJoinStatus(activity, unrelated.toString()), 'none');
assert.equal(activityViewerJoinStatus(activity), undefined);

const contradictory = makeActivity({ host, participants: [confirmed], pending: [confirmed], declined: [confirmed], waitlist: [confirmed], invited: [confirmed] });
assert.equal(activityViewerJoinStatus(contradictory, confirmed.toString()), 'participant', 'confirmed membership has canonical priority');

const privatePending = makeActivity({ host, pending: [pending], visibility: 'private' });
assert.equal(activityViewerJoinStatus(privatePending, pending.toString()), 'pending');
assert.equal(canAccessActivity(privatePending, pending.toString()), true);
privatePending.pendingParticipants = [];
assert.equal(activityViewerJoinStatus(privatePending, pending.toString()), 'none');
assert.equal(canAccessActivity(privatePending, pending.toString()), false, 'withdrawal revokes membership-only private access');

const privateConfirmed = makeActivity({ host, participants: [confirmed], visibility: 'private' });
assert.equal(activityViewerJoinStatus(privateConfirmed, confirmed.toString()), 'participant');
assert.equal(canAccessActivity(privateConfirmed, confirmed.toString()), true);

const privateInvited = makeActivity({ host, invited: [invited], visibility: 'private' });
assert.equal(activityViewerJoinStatus(privateInvited, invited.toString()), 'invited');
assert.equal(canAccessActivity(privateInvited, invited.toString()), true);

console.log('Canonical activity viewer join-state tests passed.');
