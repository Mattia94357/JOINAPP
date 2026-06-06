import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { getActivityCoverImage, getVibeForCategory } from './utils/activityAssets';
import { getAvailabilityTag } from './utils/availability';

const getHost = () => {
  const manifest = Constants.manifest ?? Constants.expoConfig ?? {};
  const envApiUrl = (manifest as any).extra?.API_URL;

  if (typeof envApiUrl === 'string' && envApiUrl.trim()) {
    return envApiUrl;
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
      const isIpAddress = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
      if (isLocal) return 'http://localhost:4000';
      if (isIpAddress) return `http://${hostname}:4000`;
      // Production: use your Vercel backend
      return 'https://joinapp-backend-8lsb.vercel.app';
    }
    return 'https://joinapp-backend-8lsb.vercel.app';
  }

  const debuggerHost = (manifest as any).debuggerHost as string | undefined;
  if (debuggerHost) {
    const address = debuggerHost.split(':').shift();
    return `http://${address}:4000`;
  }

  return Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000';
};

const BASE_URL = getHost();

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
});

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
  nationality?: string;
  instagram?: string;
  ageRange?: string;
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
  _id: string;
  name: string;
  avatar?: string;
  profilePictureUrl?: string;
  profileThumbnailUrl?: string;
  profileCompleted?: boolean;
  verified?: boolean;
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
  pendingParticipants?: RawAvatarUser[];
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
  hostVerified?: boolean;
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
  waitlist?: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string; verified?: boolean }>;
  joined?: boolean;
  pending?: boolean;
  waitlisted?: boolean;
  saved?: boolean;
  chatId?: string;
};

const mapParticipant = (participant: RawAvatarUser) => ({
  id: participant._id,
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

export const fetchActivities = async (token?: string) => {
  const response = await api.get<RawActivity[]>('/api/activities', {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  return response.data.map((activity) => ({
    id: activity._id,
    title: activity.title,
    category: activity.category,
    location: activity.location,
    description: activity.description,
    date: activity.date ? new Date(activity.date).toLocaleDateString() : undefined,
    time: activity.date ? new Date(activity.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Anytime',
    distance: '1.2 km',
    vibe: activity.vibe || getVibeForCategory(activity.category),
    attendees: activity.participants?.length || 0,
    maxAttendees: activity.maxAttendees,
    visibility: activity.visibility || 'public',
    joinApproval: activity.joinApproval || 'auto',
    status: activity.status || 'active',
    cancellationReason: activity.cancellationReason,
    galleryImages: activity.galleryImages || [],
    activityRating: activity.activityRating,
    reviewCount: activity.reviewCount,
    coverImage: activity.coverImage || getActivityCoverImage(activity.category, activity._id),
    availabilityTag: activity.availabilityTag || getAvailabilityTag(activity.date),
    host: activity.host?.name || 'Unknown',
    hostId: activity.host?._id || '',
    hostAvatar: activity.host?.profileThumbnailUrl || activity.host?.profilePictureUrl || (activity.host?.profileCompleted ? activity.host?.avatar : undefined),
    participants: activity.participants?.map(mapParticipant) || [],
    pendingParticipants: activity.pendingParticipants?.map(mapParticipant) || [],
    waitlist: activity.waitlist?.map(mapParticipant) || [],
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
    category: activity.category,
    location: activity.location,
    description: activity.description,
    date: activity.date ? new Date(activity.date).toLocaleDateString() : undefined,
    time: activity.date ? new Date(activity.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Anytime',
    distance: '1.2 km',
    vibe: activity.vibe || getVibeForCategory(activity.category),
    attendees: activity.participants?.length || 0,
    maxAttendees: activity.maxAttendees,
    visibility: activity.visibility || 'public',
    joinApproval: activity.joinApproval || 'auto',
    status: activity.status || 'active',
    cancellationReason: activity.cancellationReason,
    galleryImages: activity.galleryImages || [],
    activityRating: activity.activityRating,
    reviewCount: activity.reviewCount,
    coverImage: activity.coverImage || getActivityCoverImage(activity.category, activity._id),
    availabilityTag: activity.availabilityTag || getAvailabilityTag(activity.date),
    host: activity.host?.name || 'Unknown',
    hostId: activity.host?._id || '',
    hostAvatar: activity.host?.profileThumbnailUrl || activity.host?.profilePictureUrl || (activity.host?.profileCompleted ? activity.host?.avatar : undefined),
    participants: activity.participants?.map(mapParticipant) || [],
    pendingParticipants: activity.pendingParticipants?.map(mapParticipant) || [],
    waitlist: activity.waitlist?.map(mapParticipant) || [],
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

export const updateProfilePhotoRequest = async (profilePictureUrl: string, token: string) =>
  api.patch<ApiUser>(
    '/api/users/me/profile-photo',
    { profilePictureUrl },
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );

export const updateProfileRequest = async (
  payload: Partial<Pick<ApiUser, 'bio' | 'aboutMe' | 'location' | 'languages' | 'interests' | 'nationality' | 'instagram' | 'ageRange' | 'hasCompletedOnboardingTutorial'>>,
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
