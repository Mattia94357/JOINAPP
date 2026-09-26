import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { fetchActivity, fetchNotificationRequest, markNotificationReadRequest } from '../api';
import { parsePushData } from '../utils/pushRouting';

// Cold-start responses wait for both session restoration and navigation readiness.
export const useNativePushRouting = (navigation: any) => {
  const { token } = useAuth();
  const { refresh } = useNotifications();
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState<ReturnType<typeof parsePushData>>(null);
  const latest = useRef(token);
  latest.current = token;
  const running = useRef(new Set<string>());
  const handled = useRef(new Set<string>());
  const onReady = useCallback(() => setReady(true), []);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let mounted = true;
    const accept = (response: Notifications.NotificationResponse | null) => {
      if (!mounted || !response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      const data = parsePushData(response.notification.request.content.data);
      if (data) setPending(data);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(accept);
    void Notifications.getLastNotificationResponseAsync().then(accept).catch(() => {});
    return () => { mounted = false; subscription.remove(); };
  }, []);
  useEffect(() => {
    if (!token || !ready || !pending || !navigation.isReady()) return;
    const data = pending;
    const attempt = `${token}:${data.notificationId}`;
    if (running.current.has(attempt) || handled.current.has(data.notificationId)) return;
    running.current.add(attempt);
    void (async () => {
      const key = '@joinapp:handled-pushes';
      let opened: string[] = [];
      try { opened = JSON.parse(await AsyncStorage.getItem(key) || '[]'); } catch { /* Safe in-memory fallback. */ }
      if (!Array.isArray(opened)) opened = [];
      try {
        if (opened.includes(data.notificationId) || latest.current !== token) return;
        // Ownership, event type and target all come from the authenticated API.
        const response = await fetchNotificationRequest(data.notificationId, token);
        if (latest.current !== token) return;
        const notification = response.data;
        if (notification.type !== data.type) return;
        try { await markNotificationReadRequest(data.notificationId, token); } catch { /* Opening may proceed; inbox can retry read. */ }
        void refresh();
        if (notification.target?.type === 'activity' && notification.target.activityId === data.activityId) {
          await fetchActivity(data.activityId, token);
          if (latest.current === token && navigation.isReady()) navigation.navigate('Activity', { activityId: data.activityId });
        } else if (latest.current === token) navigation.navigate('Notifications');
      } catch {
        if (latest.current === token && navigation.isReady()) navigation.navigate('Notifications');
      } finally {
        running.current.delete(attempt);
        if (latest.current === token) {
          handled.current.add(data.notificationId);
          await AsyncStorage.setItem(key, JSON.stringify([...opened.filter((v) => typeof v === 'string'), data.notificationId].slice(-100))).catch(() => {});
          setPending((current) => current?.notificationId === data.notificationId ? null : current);
        }
      }
    })();
  }, [token, ready, pending, navigation, refresh]);
  return onReady;
};
