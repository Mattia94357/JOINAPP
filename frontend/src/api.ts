import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getActivityCoverImage, getVibeForCategory } from './utils/activityAssets';
import { getAvailabilityTag } from './utils/availability';
import { normalizeActivityCategory } from './utils/categories';

type ApiConfigStatus = {
  apiUrl: string | null;
  source: 'expo-extra' | 'public-env' | 'web-local-dev' | 'expo-host-dev' | 'platform-dev-fallback' | 'missing';
  isDev: boolean;
  hasExpoExtraApiUrl: boolean;
  error?: string;
};

const cleanUrl = (value?: unknown) => (typeof value === 'string' && value.trim() ? value.trim().replace(/\/$/, '') : null);

const getExpoExtraApiUrl = () =>
  cleanUrl(
    (Constants.expoConfig?.extra as any)?.API_URL ||
      (Constants.manifest as any)?.extra?.API_URL ||
      (Constants as any).manifest2?.extra?.expoClient?.extra?.API_URL,
  );

const getPublicEnvApiUrl = () => cleanUrl(process.env.EXPO_PUBLIC_API_URL);

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
    return { apiUrl: expoExtraApiUrl, source: 'expo-extra', isDev, hasExpoExtraApiUrl: true };
  }

  if (publicEnvApiUrl) {
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

const apiConfig = resolveApiConfig();

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
  pushToken?: string;
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

export type RawActivity = {
  _id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  date?: string;
  coverImage?: string;
  vibe?: string;
  availabilityTag?: string;
  maxAttendees?: number;
  visibility?: 'public' | 'private';
  joinApproval?: 'auto' | 'manual';
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  cancellationReason?: string;
  galleryImages?: string[];
  activityRating?: number;
  reviewCount?: number;
  viewerJoinStatus?: 'pending' | 'declined' | 'waitlisted';
  pendingParticipants?: RawAvatarUser[];
  declinedParticipants?: RawAvatarUser[];
  waitlist?: RawAvatarUser[];
  host: RawAvatarUser;
  participants: RawAvatarUser[];
};

export type ActivityResponse = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  date?: string;
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

export const registerRequest = (name: string, email: string, password: string) =>
  api.post<{ token: string; user: ApiUser }>('/api/auth/register', { name, email, password });

export const fetchActivities = async (token?: string, filters?: { hostGender?: 'male' | 'female' | 'non_binary' }) => {
  const response = await api.get<RawActivity[]>('/api/activities', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    params: { limit: 20, ...(filters?.hostGender ? { hostGender: filters.hostGender } : {}) },
  });
  return response.data.map((activity) => ({
    id: activity._id,
    title: activity.title,
    category: normalizeActivityCategory(activity.category),
    location: activity.location,
    description: activity.description,
    date: activity.date ? new Date(activity.date).toLocaleDateString() : undefined,
    time: activity.date ? new Date(activity.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Anytime',
    distance: '1.2 km',
    vibe: activity.vibe || getVibeForCategory(normalizeActivityCategory(activity.category)),
    attendees: activity.participants?.length || 0,
    maxAttendees: activity.maxAttendees,
    visibility: activity.visibility || 'public',
    joinApproval: activity.joinApproval || 'auto',
    status: activity.status || 'active',
    cancellationReason: activity.cancellationReason,
    galleryImages: activity.galleryImages || [],
    activityRating: activity.activityRating,
    reviewCount: activity.reviewCount,
    coverImage: activity.coverImage || getActivityCoverImage(normalizeActivityCategory(activity.category), activity._id),
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
    pending: activity.viewerJoinStatus === 'pending',
    declined: activity.viewerJoinStatus === 'declined',
    waitlisted: activity.viewerJoinStatus === 'waitlisted',
  }));
};

export const fetchActivity = async (activityId: string, token?: string) => {
  const response = await api.get<RawActivity>(`/api/activities/${activityId}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const activity = response.data;
  return {
    id: activity._id,
    title: activity.title,
    category: normalizeActivityCategory(activity.category),
    location: activity.location,
    description: activity.description,
    date: activity.date ? new Date(activity.date).toLocaleDateString() : undefined,
    time: activity.date ? new Date(activity.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Anytime',
    distance: '1.2 km',
    vibe: activity.vibe || getVibeForCategory(normalizeActivityCategory(activity.category)),
    attendees: activity.participants?.length || 0,
    maxAttendees: activity.maxAttendees,
    visibility: activity.visibility || 'public',
    joinApproval: activity.joinApproval || 'auto',
    status: activity.status || 'active',
    cancellationReason: activity.cancellationReason,
    galleryImages: activity.galleryImages || [],
    activityRating: activity.activityRating,
    reviewCount: activity.reviewCount,
    coverImage: activity.coverImage || getActivityCoverImage(normalizeActivityCategory(activity.category), activity._id),
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
    pending: activity.viewerJoinStatus === 'pending',
    declined: activity.viewerJoinStatus === 'declined',
    waitlisted: activity.viewerJoinStatus === 'waitlisted',
  };
};

export const createActivityRequest = async (
  payload: {
    title: string;
    category: string;
    location: string;
    description: string;
    date?: string;
    vibe?: string;
    coverImage?: string;
    maxAttendees?: number;
    venueName?: string;
    exactAddress?: string;
    startTime?: string;
    endTime?: string;
    costType?: 'Free' | 'Paid';
    costAmount?: number;
    currency?: string;
    hostNote?: string;
    cancellationPolicy?: string;
    visibility?: 'public' | 'private';
    joinApproval?: 'auto' | 'manual';
    galleryImages?: string[];
  },
  token: string,
) =>
  api.post('/api/activities', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const joinActivityRequest = async (activityId: string, token: string) =>
  api.post(`/api/activities/${activityId}/join`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const saveActivityRequest = async (activityId: string, token: string) =>
  api.post(`/api/activities/${activityId}/save`, {}, {
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

export const updateProfilePhotoRequest = async (profilePictureUrl: string, token: string, profileThumbnailUrl?: string) =>
  api.patch<ApiUser>(
    '/api/users/me/profile-photo',
    { profilePictureUrl, profileThumbnailUrl: profileThumbnailUrl || profilePictureUrl },
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

export const updatePushTokenRequest = async (pushToken: string, token: string) =>
  api.patch<ApiUser>(
    '/api/users/me/push-token',
    { pushToken },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

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

export const fetchChatRequest = async (chatId: string, token: string) =>
  api.get(`/api/chats/${chatId}`, {
    headers: { Authorization: `Bearer ${token}` },
    params: { limit: 50 },
  });

export const sendChatMessageRequest = async (chatId: string, message: string, token: string) =>
  api.post(`/api/chats/${chatId}/message`, { message }, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const forgotPasswordRequest = (email: string) =>
  api.post('/api/auth/forgot-password', { email });

export const resetPasswordRequest = (token: string, password: string) =>
  api.post('/api/auth/reset-password', { token, password });

export const fetchPublicUserRequest = (userId: string) =>
  api.get(`/api/users/${userId}`);
