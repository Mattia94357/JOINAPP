const assert = require('node:assert/strict');
const { Types } = require('mongoose');
const Activity = require('../dist/models/Activity').default;
const { activityCreateConsistencyIssue, unsupportedActivityCreateFields } = require('../dist/services/activityCreation');
const {
  activityEditEligibilityIssue,
  editUpcomingActivityAtomically,
  parseActivityEdit,
} = require('../dist/services/activityEditing');
const { effectiveActivityStatus } = require('../dist/utils/activityLifecycle');
const { sanitizeActivityPrivacy } = require('../dist/utils/activityPrivacy');

const now = new Date('2026-09-16T04:00:00.000Z');
const start = new Date('2026-09-18T11:30:00.000Z');
const end = new Date('2026-09-18T13:30:00.000Z');
const host = new Types.ObjectId();
const participant = new Types.ObjectId();

const allFields = {
  title: 'Complete activity round trip',
  category: 'Food',
  location: 'Northbridge',
  locationName: 'Shadow Wine Bar',
  venueName: 'Shadow Wine Bar',
  exactAddress: '214 William Street',
  latitude: -31.946,
  longitude: 115.858,
  isApproximateLocation: false,
  locationPrivacy: 'public',
  description: 'A complete activity description used for persistence testing.',
  date: start,
  endDate: end,
  ageGroup: '25-34',
  vibe: 'Social',
  coverImage: 'https://example.com/cover.jpg',
  galleryImages: ['https://example.com/one.jpg', 'https://example.com/two.webp'],
  maxAttendees: 8,
  visibility: 'public',
  joinApproval: 'auto',
  costType: 'Paid',
  costAmount: 24.5,
  currency: 'AUD',
  hostNote: 'Meet the host beside the front entrance.',
  cancellationPolicy: 'The activity proceeds unless severe weather is announced.',
  status: 'active',
  host,
  participants: [host, participant],
};

const created = new Activity(allFields);
assert.equal(created.validateSync(), undefined);
const reloaded = Activity.hydrate(created.toObject()).toObject();
for (const key of ['title', 'category', 'location', 'locationName', 'venueName', 'exactAddress', 'vibe', 'costType', 'costAmount', 'currency', 'hostNote', 'cancellationPolicy']) {
  assert.deepEqual(reloaded[key], allFields[key], `${key} survives schema round trip`);
}
assert.equal(reloaded.date.toISOString(), start.toISOString());
assert.equal(reloaded.endDate.toISOString(), end.toISOString());
assert.deepEqual(reloaded.galleryImages, allFields.galleryImages);
assert.equal(reloaded.coverImage, allFields.coverImage);

const oldDocument = new Activity({
  title: 'Old activity', category: 'Other', location: 'Perth',
  description: 'An older document without newly optional activity fields.',
  date: start, host, participants: [host],
});
assert.equal(oldDocument.validateSync(), undefined);
assert.equal(oldDocument.endDate, undefined);
assert.equal(oldDocument.hostNote, undefined);
assert.equal(oldDocument.costType, 'Free');
assert.equal(oldDocument.costAmount, 0);

assert.equal(activityCreateConsistencyIssue({ date: start, endDate: end, costType: 'Paid', costAmount: 24.5 }), undefined);
assert.equal(activityCreateConsistencyIssue({ date: start, endDate: start, costType: 'Free' }), 'end_before_start');
assert.equal(activityCreateConsistencyIssue({ date: start, endDate: end, costType: 'Paid', costAmount: 0 }), 'paid_cost_required');
assert.deepEqual(
  unsupportedActivityCreateFields({ title: 'Allowed', host, participants: [host], status: 'completed', createdAt: now }),
  ['host', 'participants', 'status', 'createdAt'],
);

const editResult = parseActivityEdit({
  venueName: 'Updated venue',
  exactAddress: 'Updated meeting point',
  endDate: '2026-09-18T14:00:00.000Z',
  costType: 'Paid',
  costAmount: 30,
  currency: 'AUD',
  hostNote: 'Bring a light jacket.',
  cancellationPolicy: 'Weather updates are posted by noon.',
}, now);
assert.equal(editResult.error, undefined);
assert.equal(editResult.update.endDate.toISOString(), '2026-09-18T14:00:00.000Z');
assert.equal(activityEditEligibilityIssue(created, host.toString(), editResult.update, now), undefined);
assert.equal(activityEditEligibilityIssue(created, host.toString(), { endDate: start }, now), 'end_before_start');
assert.equal(activityEditEligibilityIssue(created, host.toString(), { costType: 'Paid', costAmount: 0 }, now), 'paid_cost_required');
assert.match(parseActivityEdit({ participants: [] }, now).error, /cannot be edited/);
assert.match(parseActivityEdit({ host: participant.toString() }, now).error, /cannot be edited/);
assert.match(parseActivityEdit({ status: 'completed' }, now).error, /cannot be edited/);

const editable = {
  ...allFields,
  _id: new Types.ObjectId(),
  invitedUsers: [], pendingParticipants: [], declinedParticipants: [], waitlist: [],
};
const originalFindOneAndUpdate = Activity.findOneAndUpdate;
Activity.findOneAndUpdate = async (_filter, pipeline) => {
  for (const [key, value] of Object.entries(pipeline[0].$set)) {
    if (key === 'status') continue;
    editable[key] = value && typeof value === 'object' && Object.hasOwn(value, '$literal') ? value.$literal : value;
  }
  return editable;
};
(async () => {
  try {
    assert.ok(await editUpcomingActivityAtomically(editable._id.toString(), host.toString(), editResult.update, now));
  } finally {
    Activity.findOneAndUpdate = originalFindOneAndUpdate;
  }
  assert.equal(editable.venueName, 'Updated venue');
  assert.equal(editable.costAmount, 30);
  assert.equal(editable.hostNote, 'Bring a light jacket.');
  assert.equal(editable.endDate.toISOString(), '2026-09-18T14:00:00.000Z');

  const payload = { ...reloaded };
  const publicView = sanitizeActivityPrivacy(payload, reloaded, new Types.ObjectId().toString());
  assert.equal(publicView.exactAddress, undefined);
  assert.equal(publicView.venueName, undefined);
  assert.equal(publicView.hostNote, undefined);
  assert.equal(publicView.latitude, allFields.latitude);
  assert.equal(publicView.costAmount, 24.5);
  assert.equal(publicView.cancellationPolicy, allFields.cancellationPolicy);

  const memberView = sanitizeActivityPrivacy(payload, reloaded, participant.toString());
  assert.equal(memberView.exactAddress, allFields.exactAddress);
  assert.equal(memberView.venueName, allFields.venueName);
  assert.equal(memberView.hostNote, allFields.hostNote);

  const hostView = sanitizeActivityPrivacy(payload, reloaded, host.toString());
  assert.equal(hostView.exactAddress, allFields.exactAddress);
  assert.equal(hostView.hostNote, allFields.hostNote);

  const privateActivity = { ...reloaded, visibility: 'private', locationPrivacy: 'private' };
  const privatePublicView = sanitizeActivityPrivacy({ ...privateActivity }, privateActivity, new Types.ObjectId().toString());
  assert.equal(privatePublicView.latitude, undefined);
  assert.equal(privatePublicView.longitude, undefined);
  assert.equal(privatePublicView.exactAddress, undefined);
  assert.equal(privatePublicView.hostNote, undefined);
  assert.equal(privatePublicView.location, 'Location shared after approval');

  const privateMemberView = sanitizeActivityPrivacy({ ...privateActivity }, privateActivity, participant.toString());
  assert.equal(privateMemberView.latitude, allFields.latitude);
  assert.equal(privateMemberView.exactAddress, allFields.exactAddress);
  assert.equal(privateMemberView.hostNote, allFields.hostNote);

  assert.equal(effectiveActivityStatus({ date: start, endDate: end, status: 'active' }, new Date(start.getTime() - 1)), 'active');
  assert.equal(effectiveActivityStatus({ date: start, endDate: end, status: 'active' }, start), 'completed');

  console.log('Activity creation persistence, edit, privacy, and schema-alignment tests passed.');
})().catch((error) => {
  Activity.findOneAndUpdate = originalFindOneAndUpdate;
  console.error(error);
  process.exitCode = 1;
});
