import crypto from 'crypto';

export type PrivateActivityAccess = 'public' | 'host' | 'participant' | 'pending' | 'invited' | 'inviteCode';

type ActivityPrivacyInput = {
  visibility?: 'public' | 'private';
  locationPrivacy?: 'public' | 'approximate' | 'private';
  isApproximateLocation?: boolean;
  host?: unknown;
  participants?: unknown[];
  pendingParticipants?: unknown[];
  invitedUsers?: unknown[];
  inviteCode?: string;
};

const toId = (value: any) => value?._id?.toString?.() || value?.id?.toString?.() || value?.toString?.() || '';

export const generateActivityInviteCode = () => crypto.randomBytes(24).toString('base64url');

const inviteCodesMatch = (provided?: string, stored?: string) => {
  if (!provided || !stored) return false;
  const providedBytes = Buffer.from(provided);
  const storedBytes = Buffer.from(stored);
  return providedBytes.length === storedBytes.length
    && crypto.timingSafeEqual(providedBytes, storedBytes);
};

export const idInActivityList = (list: unknown[] | undefined, userId?: string) => Boolean(
  userId && (list || []).some((item) => toId(item) === userId),
);

export const privateActivityAccess = (
  activity: ActivityPrivacyInput,
  userId?: string,
  inviteCode?: string,
): PrivateActivityAccess | undefined => {
  if (activity.visibility !== 'private') return 'public';
  if (userId && toId(activity.host) === userId) return 'host';
  if (idInActivityList(activity.participants, userId)) return 'participant';
  if (idInActivityList(activity.pendingParticipants, userId)) return 'pending';
  if (idInActivityList(activity.invitedUsers, userId)) return 'invited';
  if (inviteCodesMatch(inviteCode, activity.inviteCode)) return 'inviteCode';
  return undefined;
};

export const canAccessActivity = (
  activity: ActivityPrivacyInput,
  userId?: string,
  inviteCode?: string,
) => Boolean(privateActivityAccess(activity, userId, inviteCode));

export const canViewPreciseActivityLocation = (
  activity: ActivityPrivacyInput,
  userId?: string,
) => {
  const access = privateActivityAccess(activity, userId);
  return access === 'host' || access === 'participant';
};

export const canAccessPrivateParticipantContent = (
  activity: ActivityPrivacyInput,
  userId?: string,
) => {
  if (activity.visibility !== 'private') return true;
  const access = privateActivityAccess(activity, userId);
  return access === 'host' || access === 'participant';
};

type SanitizeOptions = {
  includeHostInviteCode?: boolean;
};

// Sanitizes a plain activity payload. Internal membership state is always removed;
// callers may add mapped host-only moderation data back after this function returns.
export const sanitizeActivityPrivacy = <T extends Record<string, any>>(
  payload: T,
  activity: ActivityPrivacyInput,
  userId?: string,
  options: SanitizeOptions = {},
) => {
  const safePayload: Record<string, any> = { ...payload };
  const access = privateActivityAccess(activity, userId);
  const isHost = access === 'host';
  const isConfirmed = isHost || access === 'participant';
  const locationPrivacy = activity.locationPrivacy === 'private'
    ? 'private'
    : activity.locationPrivacy === 'approximate' || activity.isApproximateLocation
      ? 'approximate'
      : 'public';
  const publicPreciseLocation = activity.visibility !== 'private' && locationPrivacy === 'public';
  const canSeeCoordinates = isConfirmed || publicPreciseLocation;

  delete safePayload.pendingParticipants;
  delete safePayload.declinedParticipants;
  delete safePayload.waitlist;
  delete safePayload.invitedUsers;
  delete safePayload.inviteCode;

  if (options.includeHostInviteCode && isHost && activity.visibility === 'private' && activity.inviteCode) {
    safePayload.inviteCode = activity.inviteCode;
  }

  if (!isConfirmed) {
    delete safePayload.exactAddress;
    delete safePayload.address;
    delete safePayload.venueName;
  }

  if (!canSeeCoordinates) {
    delete safePayload.latitude;
    delete safePayload.longitude;
    delete safePayload.coordinates;
    delete safePayload.locationName;
  }

  if (locationPrivacy === 'private' && !isConfirmed) {
    safePayload.location = 'Location shared after approval';
  }

  return safePayload as T;
};
