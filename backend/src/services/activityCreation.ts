export const creatableActivityFields = [
  'title', 'category', 'location', 'locationName', 'latitude', 'longitude',
  'isApproximateLocation', 'locationPrivacy', 'description', 'date', 'endDate',
  'ageGroup', 'vibe', 'coverImage', 'maxAttendees', 'venueName', 'exactAddress',
  'costType', 'costAmount', 'currency', 'hostNote', 'cancellationPolicy',
  'visibility', 'joinApproval', 'galleryImages',
] as const;

const creatableFieldSet = new Set<string>(creatableActivityFields);

export const unsupportedActivityCreateFields = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.keys(value).filter((key) => !creatableFieldSet.has(key));
};

export type ActivityCreateConsistencyIssue = 'end_before_start' | 'paid_cost_required';

export const activityCreateConsistencyIssue = (input: {
  date: Date;
  endDate?: Date;
  costType?: string;
  costAmount?: unknown;
}): ActivityCreateConsistencyIssue | undefined => {
  if (input.endDate && input.endDate.getTime() <= input.date.getTime()) return 'end_before_start';
  const amount = Number(input.costAmount);
  if (input.costType === 'Paid' && (!Number.isFinite(amount) || amount <= 0)) return 'paid_cost_required';
  return undefined;
};
