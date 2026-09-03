const assert = require('node:assert/strict');
const {
  canAccessPrivateParticipantContent,
  canAccessActivity,
  canViewPreciseActivityLocation,
  generateActivityInviteCode,
  privateActivityAccess,
  sanitizeActivityPrivacy,
} = require('../dist/utils/activityPrivacy');

const ids = {
  host: 'host-id',
  participant: 'participant-id',
  pending: 'pending-id',
  invited: 'invited-id',
  declined: 'declined-id',
  stranger: 'stranger-id',
};

const privateActivity = {
  visibility: 'private',
  locationPrivacy: 'private',
  host: ids.host,
  participants: [ids.host, ids.participant],
  pendingParticipants: [ids.pending],
  declinedParticipants: [ids.declined],
  invitedUsers: [ids.invited],
  inviteCode: 'valid-code',
};

const privatePayload = {
  title: 'Private plan',
  location: 'Secret suburb',
  locationName: 'Secret venue',
  venueName: 'Secret venue',
  exactAddress: '1 Secret Street',
  address: '1 Secret Street',
  latitude: -20.123,
  longitude: 118.456,
  coordinates: [-20.123, 118.456],
  inviteCode: 'valid-code',
  pendingParticipants: ['pending-id'],
  declinedParticipants: ['declined-id'],
  waitlist: ['waitlisted-id'],
  invitedUsers: ['invited-id'],
};

const publicActivity = {
  visibility: 'public',
  locationPrivacy: 'public',
  host: ids.host,
  participants: [ids.host],
  inviteCode: 'public-code-must-not-leak',
};
assert.equal(canAccessActivity(publicActivity, ids.stranger), true);
const publicPayload = sanitizeActivityPrivacy({ ...privatePayload }, publicActivity, ids.stranger);
assert.equal(publicPayload.latitude, privatePayload.latitude);
assert.equal(publicPayload.locationName, privatePayload.locationName);
assert.equal(publicPayload.inviteCode, undefined);
assert.equal(publicPayload.pendingParticipants, undefined);

assert.equal(canAccessActivity(privateActivity, ids.stranger), false);
assert.equal(privateActivityAccess(privateActivity, ids.stranger), undefined);
const unauthorized = sanitizeActivityPrivacy({ ...privatePayload }, privateActivity, ids.stranger);
assert.equal(unauthorized.location, 'Location shared after approval');
for (const field of ['locationName', 'venueName', 'exactAddress', 'address', 'latitude', 'longitude', 'coordinates', 'inviteCode', 'pendingParticipants', 'declinedParticipants', 'waitlist', 'invitedUsers']) {
  assert.equal(unauthorized[field], undefined, `unauthorized payload leaked ${field}`);
}

assert.equal(privateActivityAccess(privateActivity, ids.invited), 'invited');
assert.equal(canAccessActivity(privateActivity, ids.invited), true);
assert.equal(privateActivityAccess(privateActivity, undefined, 'valid-code'), 'inviteCode');
assert.equal(canAccessActivity(privateActivity, ids.stranger, 'valid-code'), true);
assert.equal(canAccessActivity(privateActivity, ids.stranger, 'valid-code-extra'), false);
assert.equal(canAccessActivity(privateActivity, ids.stranger, ''), false);

const generatedCodes = Array.from({ length: 100 }, generateActivityInviteCode);
assert.equal(new Set(generatedCodes).size, generatedCodes.length);
for (const code of generatedCodes) {
  assert.match(code, /^[A-Za-z0-9_-]{32}$/);
}

assert.equal(privateActivityAccess(privateActivity, ids.pending), 'pending');
assert.equal(canAccessPrivateParticipantContent(privateActivity, ids.pending), false);
assert.equal(canViewPreciseActivityLocation(privateActivity, ids.pending), false);
const pending = sanitizeActivityPrivacy({ ...privatePayload }, privateActivity, ids.pending);
assert.equal(pending.location, 'Location shared after approval');
assert.equal(pending.latitude, undefined);
assert.equal(pending.exactAddress, undefined);

assert.equal(privateActivityAccess(privateActivity, ids.participant), 'participant');
assert.equal(canAccessPrivateParticipantContent(privateActivity, ids.participant), true);
assert.equal(canViewPreciseActivityLocation(privateActivity, ids.participant), true);
const participant = sanitizeActivityPrivacy({ ...privatePayload }, privateActivity, ids.participant);
assert.equal(participant.location, privatePayload.location);
assert.equal(participant.latitude, privatePayload.latitude);
assert.equal(participant.exactAddress, privatePayload.exactAddress);
assert.equal(participant.inviteCode, undefined);
assert.equal(participant.pendingParticipants, undefined);

assert.equal(privateActivityAccess(privateActivity, ids.host), 'host');
const host = sanitizeActivityPrivacy({ ...privatePayload }, privateActivity, ids.host, { includeHostInviteCode: true });
assert.equal(host.inviteCode, 'valid-code');
assert.equal(host.latitude, privatePayload.latitude);

assert.equal(privateActivityAccess(privateActivity, ids.declined), undefined);
assert.equal(canAccessActivity(privateActivity, ids.declined), false);

const approximateActivity = { ...publicActivity, locationPrivacy: 'approximate' };
const approximate = sanitizeActivityPrivacy({ ...privatePayload }, approximateActivity, ids.stranger);
assert.equal(approximate.location, privatePayload.location);
assert.equal(approximate.locationName, undefined);
assert.equal(approximate.latitude, undefined);
assert.equal(approximate.longitude, undefined);
assert.equal(approximate.exactAddress, undefined);

const approximateFlagOnly = sanitizeActivityPrivacy(
  { ...privatePayload },
  { ...publicActivity, locationPrivacy: 'public', isApproximateLocation: true },
  ids.stranger,
);
assert.equal(approximateFlagOnly.location, privatePayload.location);
assert.equal(approximateFlagOnly.latitude, undefined);
assert.equal(approximateFlagOnly.locationName, undefined);

console.log('Activity privacy and payload security tests passed.');
