const assert = require('node:assert/strict');
const {
  effectiveActivityStatus,
  hasActivityStarted,
  isActivityDiscoverable,
  isScheduledStartInFuture,
  participationClosureReason,
  upcomingActivityFilter,
} = require('../dist/utils/activityLifecycle');

const now = new Date('2026-09-01T12:00:00.000Z');
const future = new Date('2026-09-01T12:00:00.001Z');
const boundary = new Date('2026-09-01T12:00:00.000Z');
const past = new Date('2026-09-01T11:59:59.999Z');

const futureActive = { status: 'active', date: future };
assert.equal(isScheduledStartInFuture(future, now), true);
assert.equal(isScheduledStartInFuture(boundary, now), false);
assert.equal(isScheduledStartInFuture(past, now), false);
assert.equal(effectiveActivityStatus(futureActive, now), 'active');
assert.equal(isActivityDiscoverable(futureActive, now), true);
assert.equal(participationClosureReason(futureActive, now), undefined);

const futureFull = { status: 'full', date: future };
assert.equal(effectiveActivityStatus(futureFull, now), 'full');
assert.equal(isActivityDiscoverable(futureFull, now), true);
assert.equal(participationClosureReason(futureFull, now), undefined);

const cancelled = { status: 'cancelled', date: future };
assert.equal(effectiveActivityStatus(cancelled, now), 'cancelled');
assert.equal(isActivityDiscoverable(cancelled, now), false);
assert.equal(participationClosureReason(cancelled, now), 'cancelled');

const atBoundary = { status: 'active', date: boundary };
assert.equal(hasActivityStarted(atBoundary, now), true);
assert.equal(effectiveActivityStatus(atBoundary, now), 'completed');
assert.equal(isActivityDiscoverable(atBoundary, now), false);
assert.equal(participationClosureReason(atBoundary, now), 'started');

const alreadyPast = { status: 'active', date: past };
assert.equal(hasActivityStarted(alreadyPast, now), true);
assert.equal(effectiveActivityStatus(alreadyPast, now), 'completed');
assert.equal(isActivityDiscoverable(alreadyPast, now), false);
assert.equal(participationClosureReason(alreadyPast, now), 'started');

const completed = { status: 'completed', date: future };
assert.equal(effectiveActivityStatus(completed, now), 'completed');
assert.equal(isActivityDiscoverable(completed, now), false);
assert.equal(participationClosureReason(completed, now), 'completed');

// JOIN and approval use the same closure reason, while Moment eligibility uses
// hasActivityStarted. This keeps past activities closed to membership but open
// to legitimate participant/host Moments.
assert.equal(participationClosureReason(alreadyPast, now), 'started');
assert.equal(hasActivityStarted(alreadyPast, now), true);
assert.equal(hasActivityStarted(futureActive, now), false);

const discoveryFilter = upcomingActivityFilter(now);
assert.deepEqual(discoveryFilter.status.$in, ['active', 'full']);
assert.equal(discoveryFilter.date.$gt, now);

console.log('Activity lifecycle boundary tests passed.');
