import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getVibeForCategory, resolveActivityImage } from './utils/activityAssets';
import { getAvailabilityTag } from './utils/availability';
import { normalizeActivityCategory } from './utils/categories';

type ApiConfigStatus = {
  apiUrl: string | null;
  source:
    | 'expo-extra'
    | 'public-env'
    | 'web-local-dev'
    | 'expo-host-dev'
    | 'platform-dev-fallback'
    | 'missing';
  isDev: boolean;
  hasExpoExtraApiUrl: boolean;
  error?: string;
};

const cleanUrl = (value?: unknown) => (typeof value === 'string' && value.trim() ? value.trim().replace(/\/$/, '') : null);
const coordinateNumber = (value: unknown, min: number, max: number) => {
  if (value === null || value === undefined || value === '') return undefined;
  const coordinate = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(coordinate) && coordinate >= min && coordinate <= max
    ? coordinate
    : undefined;
};

const getExpoExtraApiUrl = () =>
  cleanUrl(
    (Constants.expoConfig?.extra as any)?.API_URL ||
      (Constants.manifest as any)?.extra?.API_URL ||
      (Constants as any).manifest2?.extra?.expoClient?.extra?.API_URL,
  );

const getPublicEnvApiUrl = () => cleanUrl(process.env.EXPO_PUBLIC_API_URL);

const releaseApiError = (value: string | null) => {
  if (!value) return 'JOIN API_URL is not configured for this production build.';
  try {
    const parsed = new URL(value);
    const privateHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1' || parsed.hostname === '::1' ||
      /^10\./.test(parsed.hostname) || /^192\.168\./.test(parsed.hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(parsed.hostname);
    if (parsed.protocol !== 'https:' || privateHost) return 'JOIN API_URL must be a public HTTPS URL for production builds.';
  } catch {
    return 'JOIN API_URL must be a valid absolute HTTPS URL.';
  }
  return null;
};

const getExpoHostAddress = () => {
  const hostUri =
    (Constants.expoConfig as any)?.hostUri ||
    (Constants.manifest as any)?.debuggerHost ||
    (Constants.manifest as any)?.hostUri ||
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost;

  if (typeof hostUri !== 'string' || !hostUri.trim()) return null;
  return hostUri.split(':').shift() || null;
};

const resolveApiConfig = (): ApiConfigStatus => {
  const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV !== 'production';
  const expoExtraApiUrl = getExpoExtraApiUrl();
  const publicEnvApiUrl = getPublicEnvApiUrl();

  if (expoExtraApiUrl) {
    const error = !isDev ? releaseApiError(expoExtraApiUrl) : null;
    if (error) return { apiUrl: null, source: 'missing', isDev, hasExpoExtraApiUrl: true, error };
    return { apiUrl: expoExtraApiUrl, source: 'expo-extra', isDev, hasExpoExtraApiUrl: true };
  }

  if (publicEnvApiUrl) {
    const error = !isDev ? releaseApiError(publicEnvApiUrl) : null;
    if (error) return { apiUrl: null, source: 'missing', isDev, hasExpoExtraApiUrl: false, error };
    return { apiUrl: publicEnvApiUrl, source: 'public-env', isDev, hasExpoExtraApiUrl: false };
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
      if (isDev && isLocal) {
        return { apiUrl: 'http://localhost:4000', source: 'web-local-dev', isDev, hasExpoExtraApiUrl: false };
      }
      if (isDev && isIpAddress) {
        return { apiUrl: `http://${hostname}:4000`, source: 'web-local-dev', isDev, hasExpoExtraApiUrl: false };
      }
    }
  }

  const expoHostAddress = getExpoHostAddress();
  if (isDev && expoHostAddress) {
    return { apiUrl: `http://${expoHostAddress}:4000`, source: 'expo-host-dev', isDev, hasExpoExtraApiUrl: false };
  }

  if (isDev) {
    return {
      apiUrl: Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000',
      source: 'platform-dev-fallback',
      isDev,
      hasExpoExtraApiUrl: false,
    };
  }

  return {
    apiUrl: null,
    source: 'missing',
    isDev,
    hasExpoExtraApiUrl: false,
    error: 'JOIN API_URL is not configured for this production build.',
  };
};

let apiConfig = resolveApiConfig();
let apiConfigInitialized = false;
let apiConfigInitPromise: Promise<ApiConfigStatus> | null = null;

if (apiConfig.isDev) {
  console.info('[JOIN API]', {
    apiUrl: apiConfig.apiUrl,
    environment: 'development',
    source: apiConfig.source,
    fromExpoExtraConfig: apiConfig.hasExpoExtraApiUrl,
  });
}

const api = axios.create({
  baseURL: apiConfig.apiUrl || '',
  timeout: 10000,
});

const activityChangeListeners = new Set<(authorization: string) => void>();
export const onActivityMutation = (listener: (authorization: string) => void) => {
  activityChangeListeners.add(listener);
  return () => { activityChangeListeners.delete(listener); };
};
api.interceptors.response.use((response) => {
  if (['post', 'patch', 'delete'].includes(response.config.method || '') && response.config.url?.startsWith('/api/activities/')) {
    activityChangeListeners.forEach((listener) => listener(String(response.config.headers?.Authorization || '')));
  }
  return response;
});

const applyApiConfig = (nextConfig: ApiConfigStatus) => {
  apiConfig = nextConfig;
  api.defaults.baseURL = nextConfig.apiUrl || '';
  return apiConfig;
};

export const initializeApiConfig = async () => {
  if (apiConfigInitialized) {
    return apiConfig;
  }

  if (apiConfigInitPromise) {
    return apiConfigInitPromise;
  }

  apiConfigInitPromise = (async () => {
    applyApiConfig(resolveApiConfig());

    apiConfigInitialized = true;

    if (apiConfig.isDev) {
      console.info('[JOIN API]', {
        apiUrl: apiConfig.apiUrl,
        source: apiConfig.source,
      });
    }

    return apiConfig;
  })();

  return apiConfigInitPromise;
};

api.interceptors.request.use((config) => {
  if (!apiConfig.apiUrl) {
    return Promise.reject(new Error(apiConfig.error || 'JOIN API URL is not configured.'));
  }
  return config;
});

export const getApiConfigStatus = () => apiConfig;

export type ApiUser = {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  profilePictureUrl?: string;
  profileThumbnailUrl?: string;
  profileCompleted?: boolean;
  location?: string;
  interests?: string[];
  verified?: boolean;
  bio?: string;
  aboutMe?: string;
  languages?: string[];
  instagram?: string;
  ageRange?: string;
  gender?: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
  publicGender?: boolean;
  hostRating?: number;
  activityRating?: number;
  reviewCount?: number;
  hostedCount?: number;
  joinedCount?: number;
  savedActivities?: string[];
  hasCompletedOnboardingTutorial?: boolean;
  locationPublic?: boolean;
  hostedActivitiesPublic?: boolean;
  joinedActivitiesPublic?: boolean;
};

export type RawAvatarUser = {
  _id?: string;
  id?: string;
  name: string;
  avatar?: string;
  profilePictureUrl?: string;
  profileThumbnailUrl?: string;
  profileCompleted?: boolean;
  verified?: boolean;
  gender?: 'male' | 'female' | 'non_binary';
  bio?: string;
  aboutMe?: string;
  languages?: string[];
  interests?: string[];
  hostRating?: number;
  activityRating?: number;
  reviewCount?: number;
  hostedCount?: number;
  joinedCount?: number;
};

export type ViewerJoinStatus = 'host' | 'participant' | 'pending' | 'declined' | 'waitlisted' | 'invited' | 'none';

export type RawActivity = {
  _id: string;
  title: string;
  category: string;
  location: string;
  locationName?: string;
  venueName?: string;
  exactAddress?: string;
  latitude?: number;
  longitude?: number;
  isApproximateLocation?: boolean;
  locationPrivacy?: 'public' | 'approximate' | 'private';
  description: string;
  date?: string;
  endDate?: string | null;
  startsAt?: string;
  createdAt?: string;
  ageGroup?: 'any' | '18-24' | '25-34' | '35-44' | '45+';
  coverImage?: string;
  vibe?: string;
  availabilityTag?: string;
  maxAttendees?: number;
  visibility?: 'public' | 'private';
  joinApproval?: 'auto' | 'manual';
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  cancellationReason?: string;
  galleryImages?: string[];
  costType?: 'Free' | 'Paid';
  costAmount?: number;
  currency?: 'AUD';
  hostNote?: string;
  cancellationPolicy?: string;
  activityRating?: number;
  reviewCount?: number;
  viewerJoinStatus?: ViewerJoinStatus;
  inviteCode?: string;
  pendingParticipants?: RawAvatarUser[];
  declinedParticipants?: RawAvatarUser[];
  waitlist?: RawAvatarUser[];
  host: RawAvatarUser;
  participants: RawAvatarUser[];
  participantCount?: number;
};

export type ActivityResponse = {
  id: string;
  title: string;
  category: string;
  location: string;
  locationName?: string;
  latitude?: number;
  longitude?: number;
  isApproximateLocation?: boolean;
  locationPrivacy?: 'public' | 'approximate' | 'private';
  description: string;
  date?: string;
  startsAt?: string;
  endsAt?: string;
  createdAt?: string;
  ageGroup?: 'any' | '18-24' | '25-34' | '35-44' | '45+';
  time?: string;
  distance?: string;
  vibe?: string;
  attendees?: number;
  maxAttendees?: number;
  spotsLeft?: number;
  costType?: 'Free' | 'Paid';
  costAmount?: number;
  currency?: string;
  venueName?: string;
  exactAddress?: string;
  startTime?: string;
  endTime?: string;
  hostNote?: string;
  cancellationPolicy?: string;
  hostRating?: number;
  hostHostedCount?: number;
  hostJoinedCount?: number;
  hostReviewCount?: number;
  hostVerified?: boolean;
  hostGender?: 'male' | 'female' | 'non_binary';
  coverImage?: string;
  availabilityTag?: string;
  visibility?: 'public' | 'private';
  joinApproval?: 'auto' | 'manual';
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  cancellationReason?: string;
  galleryImages?: string[];
  activityRating?: number;
  reviewCount?: number;
  host: string;
  hostId: string;
  hostAvatar?: string;
  participants: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string; verified?: boolean }>;
  pendingParticipants?: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string; verified?: boolean }>;
  declinedParticipants?: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string; verified?: boolean }>;
  waitlist?: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string; verified?: boolean }>;
  joined?: boolean;
  pending?: boolean;
  declined?: boolean;
  waitlisted?: boolean;
  saved?: boolean;
  chatId?: string;
  inviteCode?: string;
  viewerJoinStatus?: ViewerJoinStatus;
};

export type ConversationSummary = {
  id: string;
  type: 'activity' | 'direct';
  state: 'active' | 'request';
  readOnly?: boolean;
  title: string;
  image?: string;
  activity?: { id: string; title: string; coverImage?: string; status?: 'active' | 'full' | 'cancelled' | 'completed' };
  user?: { id: string; name: string; avatar?: string };
  latestMessage: string;
  latestMessageAt: string;
  unread: boolean;
  unreadCount?: number;
};

export type ConversationListResponse = {
  conversations: ConversationSummary[];
  unreadConversationCount: number;
  unreadRequestCount: number;
};

export type ChatMessageResponse = {
  id: string;
  sender: { id: string; name: string; avatar?: string };
  text: string;
  createdAt: string;
};
export type ChatPageResponse = {
  id: string;
  chatType: 'publicActivityChat' | 'privateActivityChat' | 'directPrivateChat';
  activity?: { title?: string; status?: string };
  members: Array<{ _id?: string; id?: string; name: string }>;
  readOnly: boolean;
  messages: ChatMessageResponse[];
  nextCursor: string | null;
  latestCursor: string | null;
  hasMore: boolean;
};

export type ProfileActivity = {
  _id: string;
  title: string;
  category: string;
  location?: string;
  date: string;
  visibility?: 'public' | 'private';
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  coverImage?: string;
};

export type ActivityHistoryResponse = {
  hostedActivities: ProfileActivity[];
  joinedActivities: ProfileActivity[];
  hostedCount?: number;
  joinedCount?: number;
};

export type MomentCommentResponse = {
  id: string;
  momentId: string;
  author: {
    id?: string;
    name: string;
    avatar?: string;
    profilePictureUrl?: string;
    profileThumbnailUrl?: string;
  };
  text: string;
  canDelete: boolean;
  createdAt: string;
};

export type MomentResponse = {
  id: string;
  creator: {
    id?: string;
    name: string;
    avatar?: string;
    profilePictureUrl?: string;
    profileThumbnailUrl?: string;
  };
  activity: {
    id?: string;
    title: string;
    category?: string;
    date?: string;
    location?: string;
    coverImage?: string;
    visibility?: 'public' | 'private';
  };
  images: string[];
  caption?: string;
  likeCount: number;
  likedByViewer: boolean;
  commentCount: number;
  latestComments: MomentCommentResponse[];
  canDelete: boolean;
  createdAt: string;
  updatedAt: string;
};

export type UserMomentsResponse = {
  moments: MomentResponse[];
  total: number;
};

export type MomentCommentsResponse = {
  comments: MomentCommentResponse[];
  count: number;
};

const mapParticipant = (participant: RawAvatarUser) => ({
  id: participant._id || participant.id,
  name: participant.name,
  avatar: participant.profileThumbnailUrl || participant.profilePictureUrl || (participant.profileCompleted ? participant.avatar : undefined),
  profilePictureUrl: participant.profilePictureUrl,
  profileThumbnailUrl: participant.profileThumbnailUrl,
  verified: participant.verified,
});

export const loginRequest = (email: string, password: string) =>
  api.post<{ token: string; user: ApiUser }>('/api/auth/login', { email, password });

export type ReportTargetType = 'user' | 'activity' | 'moment' | 'comment';
export const submitReportRequest = (targetType: ReportTargetType, targetId: string, reason: string, detail: string, token: string) =>
  api.post('/api/reports', { targetType, targetId, reason, detail }, { headers: { Authorization: `Bearer ${token}` } });
export type BlockedUser = { id: string; name: string; avatar?: string };
export const fetchBlockedUsersRequest = (token: string) =>
  api.get<BlockedUser[]>('/api/users/me/blocked-users', { headers: { Authorization: `Bearer ${token}` } });
export const unblockUserRequest = (id: string, token: string) =>
  api.post(`/api/users/${id}/unblock`, {}, { headers: { Authorization: `Bearer ${token}` } });

export const registerRequest = (name: string, email: string, password: string) =>
  api.post<{ token: string; user: ApiUser }>('/api/auth/register', { name, email, password });

export const fetchCurrentUserRequest = (token: string) =>
  api.get<ApiUser>('/api/users/me', { headers: { Authorization: `Bearer ${token}` } });

export const fetchOwnActivityHistoryRequest = (token: string) =>
  api.get<ActivityHistoryResponse>('/api/users/me/history', { headers: { Authorization: `Bearer ${token}` } });

export const fetchActivities = async (token?: string) => {
  const response = await api.get<RawActivity[]>('/api/activities', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    params: { limit: 50 },
  });
  return response.data.map((activity) => ({
    id: activity._id,
    title: activity.title,
    category: normalizeActivityCategory(activity.category),
    location: activity.location,
    locationName: activity.locationName || activity.venueName,
    venueName: activity.venueName,
    exactAddress: activity.exactAddress,
    latitude: coordinateNumber(activity.latitude, -90, 90),
    longitude: coordinateNumber(activity.longitude, -180, 180),
    isApproximateLocation: activity.isApproximateLocation,
    locationPrivacy: activity.locationPrivacy,
    description: activity.description,
    date: activity.date ? new Date(activity.date).toLocaleDateString() : undefined,
    startsAt: activity.date,
    endsAt: activity.endDate || undefined,
    endTime: activity.endDate ? new Date(activity.endDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : undefined,
    createdAt: activity.createdAt,
    ageGroup: activity.ageGroup || 'any',
    time: activity.date ? new Date(activity.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Anytime',
    vibe: activity.vibe || getVibeForCategory(normalizeActivityCategory(activity.category)),
    attendees: activity.participantCount ?? activity.participants?.length ?? 0,
    maxAttendees: activity.maxAttendees,
    costType: activity.costType || 'Free',
    costAmount: activity.costAmount || 0,
    currency: activity.currency || 'AUD',
    hostNote: activity.hostNote,
    cancellationPolicy: activity.cancellationPolicy,
    visibility: activity.visibility || 'public',
    joinApproval: activity.joinApproval || 'auto',
    status: activity.status || 'active',
    cancellationReason: activity.cancellationReason,
    galleryImages: activity.galleryImages || [],
    activityRating: activity.activityRating,
    reviewCount: activity.reviewCount,
    coverImage: resolveActivityImage({ uploadedImage: activity.coverImage, category: normalizeActivityCategory(activity.category) }),
    availabilityTag: activity.availabilityTag || getAvailabilityTag(activity.date),
    host: activity.host?.name || 'Unknown',
    hostId: activity.host?._id || activity.host?.id || '',
    hostAvatar: activity.host?.profileThumbnailUrl || activity.host?.profilePictureUrl || (activity.host?.profileCompleted ? activity.host?.avatar : undefined),
    hostRating: activity.host?.hostRating,
    hostHostedCount: activity.host?.hostedCount,
    hostJoinedCount: activity.host?.joinedCount,
    hostReviewCount: activity.host?.reviewCount,
    hostVerified: activity.host?.verified,
    hostGender: activity.host?.gender,
    participants: activity.participants?.map(mapParticipant) || [],
    pendingParticipants: activity.pendingParticipants?.map(mapParticipant) || [],
    declinedParticipants: activity.declinedParticipants?.map(mapParticipant) || [],
    waitlist: activity.waitlist?.map(mapParticipant) || [],
    viewerJoinStatus: activity.viewerJoinStatus,
    joined: activity.viewerJoinStatus === 'host' || activity.viewerJoinStatus === 'participant',
    pending: activity.viewerJoinStatus === 'pending',
    declined: activity.viewerJoinStatus === 'declined',
    waitlisted: activity.viewerJoinStatus === 'waitlisted',
  }));
};

export const fetchActivity = async (activityId: string, token?: string, inviteCode?: string) => {
  const response = await api.get<RawActivity>(`/api/activities/${activityId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    params: inviteCode ? { inviteCode } : undefined,
  });
  const activity = response.data;
  return {
    id: activity._id,
    title: activity.title,
    category: normalizeActivityCategory(activity.category),
    location: activity.location,
    locationName: activity.locationName || activity.venueName,
    venueName: activity.venueName,
    exactAddress: activity.exactAddress,
    latitude: coordinateNumber(activity.latitude, -90, 90),
    longitude: coordinateNumber(activity.longitude, -180, 180),
    isApproximateLocation: activity.isApproximateLocation,
    locationPrivacy: activity.locationPrivacy,
    description: activity.description,
    date: activity.date ? new Date(activity.date).toLocaleDateString() : undefined,
    startsAt: activity.date,
    endsAt: activity.endDate || undefined,
    endTime: activity.endDate ? new Date(activity.endDate).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : undefined,
    createdAt: activity.createdAt,
    ageGroup: activity.ageGroup || 'any',
    time: activity.date ? new Date(activity.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Anytime',
    vibe: activity.vibe || getVibeForCategory(normalizeActivityCategory(activity.category)),
    attendees: activity.participantCount ?? activity.participants?.length ?? 0,
    maxAttendees: activity.maxAttendees,
    costType: activity.costType || 'Free',
    costAmount: activity.costAmount || 0,
    currency: activity.currency || 'AUD',
    hostNote: activity.hostNote,
    cancellationPolicy: activity.cancellationPolicy,
    visibility: activity.visibility || 'public',
    joinApproval: activity.joinApproval || 'auto',
    status: activity.status || 'active',
    cancellationReason: activity.cancellationReason,
    galleryImages: activity.galleryImages || [],
    activityRating: activity.activityRating,
    reviewCount: activity.reviewCount,
    coverImage: resolveActivityImage({ uploadedImage: activity.coverImage, category: normalizeActivityCategory(activity.category) }),
    availabilityTag: activity.availabilityTag || getAvailabilityTag(activity.date),
    host: activity.host?.name || 'Unknown',
    hostId: activity.host?._id || activity.host?.id || '',
    hostAvatar: activity.host?.profileThumbnailUrl || activity.host?.profilePictureUrl || (activity.host?.profileCompleted ? activity.host?.avatar : undefined),
    hostRating: activity.host?.hostRating,
    hostHostedCount: activity.host?.hostedCount,
    hostJoinedCount: activity.host?.joinedCount,
    hostReviewCount: activity.host?.reviewCount,
    hostVerified: activity.host?.verified,
    hostGender: activity.host?.gender,
    participants: activity.participants?.map(mapParticipant) || [],
    pendingParticipants: activity.pendingParticipants?.map(mapParticipant) || [],
    declinedParticipants: activity.declinedParticipants?.map(mapParticipant) || [],
    waitlist: activity.waitlist?.map(mapParticipant) || [],
    viewerJoinStatus: activity.viewerJoinStatus,
    joined: activity.viewerJoinStatus === 'host' || activity.viewerJoinStatus === 'participant',
    pending: activity.viewerJoinStatus === 'pending',
    declined: activity.viewerJoinStatus === 'declined',
    waitlisted: activity.viewerJoinStatus === 'waitlisted',
    inviteCode: activity.inviteCode,
  };
};

export const createActivityRequest = async (
  payload: {
    title: string;
    category: string;
    location: string;
    locationName?: string;
    latitude?: number;
    longitude?: number;
    isApproximateLocation?: boolean;
    locationPrivacy?: 'public' | 'approximate' | 'private';
    description: string;
    date?: string;
    endDate?: string;
    vibe?: string;
    coverImage?: string;
    coverImageData?: string;
    maxAttendees?: number;
    venueName?: string;
    exactAddress?: string;
    costType?: 'Free' | 'Paid';
    costAmount?: number;
    currency?: string;
    hostNote?: string;
    cancellationPolicy?: string;
    visibility?: 'public' | 'private';
    joinApproval?: 'auto' | 'manual';
    ageGroup?: 'any' | '18-24' | '25-34' | '35-44' | '45+';
  },
  token: string,
) =>
  api.post('/api/activities', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

export type ActivityEditPayload = Partial<Pick<RawActivity,
  | 'title'
  | 'category'
  | 'location'
  | 'locationName'
  | 'latitude'
  | 'longitude'
  | 'isApproximateLocation'
  | 'locationPrivacy'
  | 'description'
  | 'date'
  | 'endDate'
  | 'ageGroup'
  | 'coverImage'
  | 'galleryImages'
  | 'vibe'
  | 'maxAttendees'
  | 'venueName'
  | 'exactAddress'
  | 'costType'
  | 'costAmount'
  | 'currency'
  | 'hostNote'
  | 'cancellationPolicy'
>>;

export const updateActivityRequest = (activityId: string, payload: ActivityEditPayload, token: string) =>
  api.patch<RawActivity>(`/api/activities/${activityId}`, payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const joinActivityRequest = async (activityId: string, token: string, inviteCode?: string) =>
  api.post(`/api/activities/${activityId}/join`, inviteCode ? { inviteCode } : {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const leaveActivityRequest = async (activityId: string, token: string) =>
  api.post(`/api/activities/${activityId}/leave`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const removeActivityParticipantRequest = async (activityId: string, userId: string, token: string) =>
  api.post<RawActivity>(`/api/activities/${activityId}/remove-participant/${userId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const withdrawJoinRequest = async (activityId: string, token: string) =>
  api.post(`/api/activities/${activityId}/withdraw`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const leaveActivityWaitlistRequest = async (activityId: string, token: string) =>
  api.post(`/api/activities/${activityId}/leave-waitlist`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const saveActivityRequest = async (activityId: string, token: string, inviteCode?: string) =>
  api.post(`/api/activities/${activityId}/save`, inviteCode ? { inviteCode } : {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const approveJoinRequest = async (activityId: string, userId: string, token: string) =>
  api.post(`/api/activities/${activityId}/approve/${userId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const declineJoinRequest = async (activityId: string, userId: string, token: string) =>
  api.post(`/api/activities/${activityId}/decline/${userId}`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const cancelActivityRequest = async (activityId: string, token: string, reason?: string) =>
  api.post(`/api/activities/${activityId}/cancel`, { reason }, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const updateProfilePhotoRequest = async (profilePictureUrl: string, token: string) =>
  api.patch<ApiUser>(
    '/api/users/me/profile-photo',
    { profilePictureUrl },
    {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 30000,
    },
  );

export const updateProfileRequest = async (
  payload: Partial<Pick<ApiUser, 'bio' | 'aboutMe' | 'location' | 'languages' | 'interests' | 'instagram' | 'ageRange' | 'gender' | 'publicGender' | 'hasCompletedOnboardingTutorial'>>,
  token: string,
) =>
  api.patch<ApiUser>('/api/users/me/profile', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const registerPushDeviceRequest = (installationId: string, payload: { expoPushToken: string; projectId: string; platform: 'ios' | 'android' }, token: string) =>
  api.put<{ registrationId: string }>(`/api/push-devices/${installationId}`, payload, { headers: { Authorization: `Bearer ${token}` } });
export const revokePushDeviceRequest = (installationId: string, registrationId: string, token: string) =>
  api.delete(`/api/push-devices/${installationId}`, { headers: { Authorization: `Bearer ${token}` }, data: { registrationId } });
export const fetchNotificationRequest = (id: string, token: string) =>
  api.get<AppNotification>(`/api/notifications/${id}`, { headers: { Authorization: `Bearer ${token}` } });

export type AppNotification = {
  id: string;
  type: 'join_request' | 'join_approved' | 'join_declined' | 'waitlist_promoted' | 'participant_removed' | 'activity_cancelled' | 'activity_edited';
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  target: { type: 'activity'; activityId: string } | null;
  activityTitle: string | null;
};
export const fetchNotificationsRequest = (token: string, cursor?: string) =>
  api.get<{ notifications: AppNotification[]; nextCursor: string | null }>('/api/notifications', {
    headers: { Authorization: `Bearer ${token}` }, params: { cursor, limit: 20 },
  });
export const fetchNotificationCountRequest = (token: string) =>
  api.get<{ unreadCount: number }>('/api/notifications/unread-count', { headers: { Authorization: `Bearer ${token}` } });
export const markNotificationReadRequest = (id: string, token: string) =>
  api.patch<{ id: string; readAt: string }>(`/api/notifications/${id}/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
export const markAllNotificationsReadRequest = (token: string) =>
  api.patch('/api/notifications/read-all', {}, { headers: { Authorization: `Bearer ${token}` } });

export const deleteAccountRequest = async (token: string) =>
  api.delete('/api/users/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const reportUserRequest = async (userId: string, token: string, reason?: string) =>
  api.post(
    `/api/users/${userId}/report`,
    { reason },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

export const blockUserRequest = async (userId: string, token: string) =>
  api.post(
    `/api/users/${userId}/block`,
    {},
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

export const fetchChatRequest = async (chatId: string, token: string, cursor?: { before?: string; after?: string }) =>
  api.get<ChatPageResponse>(`/api/chats/${chatId}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 50, ...cursor },
  });

export const sendChatMessageRequest = async (chatId: string, message: string, clientMessageId: string, token: string) =>
  api.post<{ message: ChatMessageResponse }>(`/api/chats/${chatId}/message`, { message, clientMessageId }, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const fetchConversationsRequest = async (token: string, scope: 'active' | 'requests' = 'active') =>
  api.get<ConversationListResponse>('/api/chats', {
    headers: { Authorization: `Bearer ${token}` },
    params: { scope },
  });

export const fetchUnreadConversationCountRequest = async (token: string) =>
  api.get<{ unreadConversationCount: number; unreadRequestCount: number }>('/api/chats/unread-count', {
    headers: { Authorization: `Bearer ${token}` },
  });

export const openDirectConversationRequest = async (userId: string, token: string) =>
  api.post<{ chatId: string; state: 'active' | 'request'; title: string }>(
    `/api/chats/direct/${userId}`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );

export const forgotPasswordRequest = (email: string) =>
  api.post('/api/auth/forgot-password', { email });

export const resetPasswordRequest = (token: string, password: string) =>
  api.post('/api/auth/reset-password', { token, password });

export const fetchPublicUserRequest = (userId: string, token?: string) =>
  api.get<ApiUser & ActivityHistoryResponse>(`/api/users/${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

export const fetchUserMomentsRequest = (userId: string, token?: string) =>
  api.get<UserMomentsResponse>(`/api/moments/user/${userId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

export const fetchActivityMomentsRequest = (activityId: string, token?: string) =>
  api.get<MomentResponse[]>(`/api/moments/activity/${activityId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

export const createMomentRequest = (activityId: string, images: string[], caption: string, token: string, clientRequestId?: string) =>
  api.post<MomentResponse>('/api/moments', { activityId, images, caption, clientRequestId }, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 45000,
  });

export const deleteMomentRequest = (momentId: string, token: string) =>
  api.delete(`/api/moments/${momentId}`, { headers: { Authorization: `Bearer ${token}` } });

export const likeMomentRequest = (momentId: string, token: string) =>
  api.post<{ liked: true; likeCount: number }>(`/api/moments/${momentId}/like`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const unlikeMomentRequest = (momentId: string, token: string) =>
  api.delete<{ liked: false; likeCount: number }>(`/api/moments/${momentId}/like`, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const fetchMomentCommentsRequest = (momentId: string, token?: string) =>
  api.get<MomentCommentsResponse>(`/api/moments/${momentId}/comments`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

export const createMomentCommentRequest = (
  momentId: string,
  text: string,
  clientRequestId: string,
  token: string,
) => api.post<{ comment: MomentCommentResponse; commentCount: number }>(
  `/api/moments/${momentId}/comments`,
  { text, clientRequestId },
  { headers: { Authorization: `Bearer ${token}` } },
);

export const deleteMomentCommentRequest = (momentId: string, commentId: string, token: string) =>
  api.delete<{ commentCount: number }>(`/api/moments/${momentId}/comments/${commentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
