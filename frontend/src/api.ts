import axios from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const getHost = () => {
  const manifest = Constants.manifest ?? Constants.expoConfig ?? {};
  const envApiUrl = (manifest as any).extra?.API_URL as string | undefined;

  if (envApiUrl) {
    return envApiUrl;
  }

  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') {
      return `http://${window.location.hostname}:4000`;
    }
    return 'http://localhost:4000';
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
};

export type RawAvatarUser = {
  _id: string;
  name: string;
  avatar?: string;
};

export type RawActivity = {
  _id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  date?: string;
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
  host: string;
  hostId: string;
  hostAvatar?: string;
  participants: Array<{ name: string; avatar?: string }>;
};

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
    distance: activity.distance || '1.2 km',
    vibe: activity.vibe || 'Social',
    attendees: activity.participants?.length || 0,
    host: activity.host?.name || 'Unknown',
    hostId: activity.host?._id || '',
    hostAvatar: activity.host?.avatar,
    participants: activity.participants?.map((participant) => ({ name: participant.name, avatar: participant.avatar })) || [],
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
    distance: activity.distance || '1.2 km',
    vibe: activity.vibe || 'Social',
    attendees: activity.participants?.length || 0,
    host: activity.host?.name || 'Unknown',
    hostId: activity.host?._id || '',
    hostAvatar: activity.host?.avatar,
    participants: activity.participants?.map((participant) => ({ name: participant.name, avatar: participant.avatar })) || [],
  };
};

export const createActivityRequest = async (
  payload: { title: string; category: string; location: string; description: string; date?: string; vibe?: string },
  token: string,
) =>
  api.post('/api/activities', payload, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const joinActivityRequest = async (activityId: string, token: string) =>
  api.post(`/api/activities/${activityId}/join`, {}, {
    headers: { Authorization: `Bearer ${token}` },
  });

export const fetchChatRequest = async (chatId: string, token: string) =>
  api.get(`/api/chats/${chatId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
