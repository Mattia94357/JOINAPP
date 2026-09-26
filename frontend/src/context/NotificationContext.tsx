import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuth } from './AuthContext';
import { fetchNotificationCountRequest, onActivityMutation } from '../api';

const Context = createContext({ unreadCount: 0, refresh: async () => {} });
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [count, setCount] = useState({ token, value: 0 });
  const latestToken = useRef(token);
  latestToken.current = token;
  const sequence = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++sequence.current;
    if (!token) return;
    try {
      const response = await fetchNotificationCountRequest(token);
      if (latestToken.current === token && request === sequence.current) setCount({ token, value: response.data.unreadCount });
    } catch { /* Keep last known count; the screen reports fetch failures. */ }
  }, [token]);
  useEffect(() => {
    void refresh();
    if (!token) return;
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh(); }, 30000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    const received = Platform.OS !== 'web' ? Notifications.addNotificationReceivedListener(() => { void refresh(); }) : undefined;
    let delayed: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = onActivityMutation((authorization) => {
      if (authorization !== `Bearer ${token}`) return;
      void refresh();
      if (delayed) clearTimeout(delayed);
      delayed = setTimeout(() => void refresh(), 6000); // Allow the durable queue to drain.
    });
    return () => { clearInterval(timer); if (delayed) clearTimeout(delayed); unsubscribe(); subscription.remove(); received?.remove(); };
  }, [token, refresh]);
  return <Context.Provider value={{ unreadCount: count.token === token ? count.value : 0, refresh }}>{children}</Context.Provider>;
}
export const useNotifications = () => useContext(Context);
