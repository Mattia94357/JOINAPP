import { Types } from 'mongoose';
import Activity, { IActivity } from '../models/Activity';
import { isScheduledStartInFuture, participationClosureReason, upcomingActivityFilter } from '../utils/activityLifecycle';

const allowedCategories = new Set([
  'Wellness', 'Food', 'Drinks', 'Networking', 'Outdoors', 'Adventure', 'Sports',
  'Fitness', 'Beach', 'Nightlife', 'Travel', 'Dating & Singles', 'Culture', 'Music',
  'Coworking', 'Other',
]);
const allowedAgeGroups = new Set(['any', '18-24', '25-34', '35-44', '45+']);
const allowedLocationPrivacy = new Set(['public', 'approximate', 'private']);
const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;

export const editableActivityFields = [
  'title', 'category', 'location', 'locationName', 'latitude', 'longitude',
  'isApproximateLocation', 'locationPrivacy', 'description', 'date', 'ageGroup',
  'endDate', 'coverImage', 'galleryImages', 'vibe', 'maxAttendees', 'venueName',
  'exactAddress', 'costType', 'costAmount', 'currency', 'hostNote', 'cancellationPolicy',
] as const;

type EditableActivityField = typeof editableActivityFields[number];
export type ActivityEdit = Partial<Omit<Pick<IActivity, EditableActivityField>, 'endDate'>> & { endDate?: Date | null };
export type ActivityEditParseResult = { update: ActivityEdit; error?: never } | { update?: never; error: string };

const cleanText = (value: string) => value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
const own = (body: Record<string, unknown>, key: string) => Object.prototype.hasOwnProperty.call(body, key);

export const parseActivityEdit = (value: unknown, now = new Date()): ActivityEditParseResult => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { error: 'Provide the activity fields you want to update.' };
  }
  const body = value as Record<string, unknown>;
  const unexpected = Object.keys(body).filter((key) => !editableActivityFields.includes(key as EditableActivityField));
  if (unexpected.length) {
    return { error: `These activity fields cannot be edited: ${unexpected.join(', ')}.` };
  }
  if (!Object.keys(body).length) return { error: 'Provide at least one activity field to update.' };

  const update: ActivityEdit = {};
  const textField = (key: 'title' | 'location' | 'description', min: number, max: number) => {
    if (!own(body, key)) return undefined;
    if (typeof body[key] !== 'string') return `${key} must be text.`;
    const text = cleanText(body[key] as string);
    if (text.length < min || text.length > max) return `${key} must be between ${min} and ${max} characters.`;
    update[key] = text;
    return undefined;
  };
  const titleError = textField('title', 3, 120);
  if (titleError) return { error: titleError };
  const locationError = textField('location', 2, 120);
  if (locationError) return { error: locationError };
  const descriptionError = textField('description', 20, 3000);
  if (descriptionError) return { error: descriptionError };

  if (own(body, 'category')) {
    if (typeof body.category !== 'string' || !allowedCategories.has(body.category)) return { error: 'Choose a valid activity category.' };
    update.category = body.category;
  }
  for (const [key, max] of [['locationName', 120], ['vibe', 80]] as const) {
    if (!own(body, key)) continue;
    if (typeof body[key] !== 'string') return { error: `${key} must be text.` };
    const text = cleanText(body[key] as string);
    if (text.length > max) return { error: `${key} must be ${max} characters or fewer.` };
    update[key] = text;
  }
  if (own(body, 'date')) {
    if (typeof body.date !== 'string') return { error: 'Activity date must be an ISO date and time.' };
    const date = new Date(body.date);
    if (!isScheduledStartInFuture(date, now)) return { error: 'Activity start time must be in the future.' };
    update.date = date;
  }
  if (own(body, 'endDate')) {
    if (body.endDate === null || body.endDate === '') update.endDate = null;
    else {
      if (typeof body.endDate !== 'string') return { error: 'Activity end time must be an ISO date and time.' };
      const endDate = new Date(body.endDate);
      if (!Number.isFinite(endDate.getTime())) return { error: 'Activity end time must be an ISO date and time.' };
      update.endDate = endDate;
    }
  }
  if (own(body, 'maxAttendees')) {
    if (!Number.isInteger(body.maxAttendees) || Number(body.maxAttendees) < 2) return { error: 'Max participants must be an integer of at least 2.' };
    update.maxAttendees = Number(body.maxAttendees);
  }
  if (own(body, 'ageGroup')) {
    if (typeof body.ageGroup !== 'string' || !allowedAgeGroups.has(body.ageGroup)) return { error: 'Choose a valid age group.' };
    update.ageGroup = body.ageGroup as IActivity['ageGroup'];
  }
  if (own(body, 'locationPrivacy')) {
    if (typeof body.locationPrivacy !== 'string' || !allowedLocationPrivacy.has(body.locationPrivacy)) return { error: 'Choose a valid location privacy setting.' };
    update.locationPrivacy = body.locationPrivacy as IActivity['locationPrivacy'];
  }
  if (own(body, 'isApproximateLocation')) {
    if (typeof body.isApproximateLocation !== 'boolean') return { error: 'isApproximateLocation must be true or false.' };
    update.isApproximateLocation = body.isApproximateLocation;
  }

  for (const [key, max] of [['venueName', 120], ['exactAddress', 240], ['hostNote', 500], ['cancellationPolicy', 500]] as const) {
    if (!own(body, key)) continue;
    if (typeof body[key] !== 'string') return { error: `${key} must be text.` };
    update[key] = cleanText(body[key] as string).slice(0, max);
  }
  if (own(body, 'costType')) {
    if (body.costType !== 'Free' && body.costType !== 'Paid') return { error: 'Choose Free or Paid for activity cost.' };
    update.costType = body.costType;
    if (body.costType === 'Free') update.costAmount = 0;
  }
  if (own(body, 'costAmount')) {
    if (typeof body.costAmount !== 'number' || !Number.isFinite(body.costAmount) || body.costAmount < 0) {
      return { error: 'Activity cost must be a non-negative number.' };
    }
    update.costAmount = body.costAmount;
  }
  if (own(body, 'currency')) {
    if (body.currency !== 'AUD') return { error: 'Activity currency must be AUD.' };
    update.currency = 'AUD';
  }

  const hasLatitude = own(body, 'latitude');
  const hasLongitude = own(body, 'longitude');
  if (hasLatitude !== hasLongitude) return { error: 'Both latitude and longitude are required when changing coordinates.' };
  if (hasLatitude) {
    if (typeof body.latitude !== 'number' || !Number.isFinite(body.latitude) || body.latitude < -90 || body.latitude > 90
      || typeof body.longitude !== 'number' || !Number.isFinite(body.longitude) || body.longitude < -180 || body.longitude > 180) {
      return { error: 'Provide valid latitude and longitude coordinates.' };
    }
    update.latitude = body.latitude;
    update.longitude = body.longitude;
  }

  if (own(body, 'coverImage')) {
    if (typeof body.coverImage !== 'string') return { error: 'Cover image must be an image URL.' };
    const image = body.coverImage.trim();
    if (image && !imageUrlPattern.test(image)) return { error: 'Use a valid JPEG, PNG, or WEBP cover image URL.' };
    update.coverImage = image;
  }
  if (own(body, 'galleryImages')) {
    if (!Array.isArray(body.galleryImages) || body.galleryImages.length > 5) return { error: 'Use up to 5 gallery image URLs.' };
    const images = body.galleryImages.map((image) => typeof image === 'string' ? image.trim() : image);
    if (images.some((image) => typeof image !== 'string' || !imageUrlPattern.test(image))) {
      return { error: 'Gallery images must be valid JPEG, PNG, or WEBP URLs.' };
    }
    update.galleryImages = images as string[];
  }
  return { update };
};

export type ActivityEditEligibilityIssue = 'not_host' | 'cancelled' | 'completed' | 'started' | 'capacity_below_members' | 'end_before_start' | 'paid_cost_required';

export const activityEditEligibilityIssue = (
  activity: Partial<IActivity>,
  userId: string,
  update: ActivityEdit,
  now = new Date(),
): ActivityEditEligibilityIssue | undefined => {
  if (activity.host?._id?.toString?.() !== userId && activity.host?.toString?.() !== userId) return 'not_host';
  const closure = participationClosureReason(activity as Pick<IActivity, 'date' | 'status'>, now);
  if (closure) return closure;
  if (update.maxAttendees !== undefined && update.maxAttendees < (activity.participants || []).length) return 'capacity_below_members';
  const effectiveStart = update.date || activity.date;
  const effectiveEnd = update.endDate !== undefined ? update.endDate : activity.endDate;
  if (effectiveEnd && effectiveStart && effectiveEnd.getTime() <= new Date(effectiveStart).getTime()) return 'end_before_start';
  const effectiveCostType = update.costType || activity.costType || 'Free';
  const effectiveCostAmount = update.costAmount !== undefined ? update.costAmount : activity.costAmount || 0;
  if (effectiveCostType === 'Paid' && effectiveCostAmount <= 0) return 'paid_cost_required';
  return undefined;
};

const literal = (value: unknown) => ({ $literal: value });

export const editUpcomingActivityAtomically = (
  activityId: string,
  hostId: string,
  update: ActivityEdit,
  now = new Date(),
) => {
  const participantCount = { $size: { $ifNull: ['$participants', []] } };
  const maxAttendees = update.maxAttendees === undefined ? '$maxAttendees' : literal(update.maxAttendees);
  const set: Record<string, unknown> = {};
  Object.entries(update).forEach(([key, value]) => { set[key] = literal(value); });
  set.status = {
    $cond: [
      { $and: [{ $ne: [{ $ifNull: [maxAttendees, null] }, null] }, { $gte: [participantCount, maxAttendees] }] },
      'full',
      'active',
    ],
  };

  return Activity.findOneAndUpdate(
    {
      _id: activityId,
      host: new Types.ObjectId(hostId),
      ...upcomingActivityFilter(now),
      ...(update.maxAttendees === undefined ? {} : { $expr: { $lte: [participantCount, update.maxAttendees] } }),
    },
    [{ $set: set }],
    { new: true, runValidators: true },
  );
};
