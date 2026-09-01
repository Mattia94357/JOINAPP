import { FilterQuery } from 'mongoose';
import Activity, { IActivity } from '../models/Activity';

const incompletePastFilter = (now: Date) => ({
  status: { $in: ['active', 'full'] },
  date: { $lte: now },
});

// This persistence is opportunistic. Route eligibility also compares dates directly,
// so lifecycle correctness does not depend on a scheduler running.
export const completePastActivities = (
  now = new Date(),
  scope: FilterQuery<IActivity> = {},
) => Activity.updateMany(
  { ...scope, ...incompletePastFilter(now) },
  { $set: { status: 'completed' } },
);

export const completeActivityIfPast = (
  activityId: string,
  now = new Date(),
) => Activity.updateOne(
  { _id: activityId, ...incompletePastFilter(now) },
  { $set: { status: 'completed' } },
);
