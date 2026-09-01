export type ActivityLifecycleStatus = 'active' | 'full' | 'cancelled' | 'completed';

export type ActivityLifecycleInput = {
  date: Date | string | number;
  status?: ActivityLifecycleStatus;
};

const scheduledTime = (value: Date | string | number) => new Date(value).getTime();

export const isScheduledStartInFuture = (
  date: Date | string | number,
  now = new Date(),
) => {
  const startsAt = scheduledTime(date);
  return Number.isFinite(startsAt) && startsAt > now.getTime();
};

// V1 has no reliable end time, so the scheduled start is the single lifecycle boundary.
export const hasActivityStarted = (
  activity: Pick<ActivityLifecycleInput, 'date'>,
  now = new Date(),
) => {
  return !isScheduledStartInFuture(activity.date, now);
};

export const effectiveActivityStatus = (
  activity: ActivityLifecycleInput,
  now = new Date(),
): ActivityLifecycleStatus => {
  if (activity.status === 'cancelled') return 'cancelled';
  if (activity.status === 'completed' || hasActivityStarted(activity, now)) return 'completed';
  return activity.status === 'full' ? 'full' : 'active';
};

export const isActivityDiscoverable = (
  activity: ActivityLifecycleInput,
  now = new Date(),
) => {
  const status = effectiveActivityStatus(activity, now);
  return (status === 'active' || status === 'full') && !hasActivityStarted(activity, now);
};

export type ParticipationClosureReason = 'cancelled' | 'completed' | 'started';

export const participationClosureReason = (
  activity: ActivityLifecycleInput,
  now = new Date(),
): ParticipationClosureReason | undefined => {
  if (activity.status === 'cancelled') return 'cancelled';
  if (activity.status === 'completed') return 'completed';
  if (hasActivityStarted(activity, now)) return 'started';
  return undefined;
};

export const upcomingActivityFilter = (now = new Date()) => ({
  status: { $in: ['active', 'full'] as ActivityLifecycleStatus[] },
  date: { $gt: now },
});
