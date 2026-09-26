import React, { useCallback, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { AppNotification, fetchActivity, fetchNotificationsRequest, markNotificationReadRequest, markAllNotificationsReadRequest } from '../api';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../theme';
import BottomNavigation from '../components/BottomNavigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export default function NotificationsScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { refresh } = useNotifications();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const actionLock = useRef(false);
  const load = useCallback(async (next?: string) => {
    if (!token) return;
    const request = ++generation.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetchNotificationsRequest(token, next);
      if (request !== generation.current) return;
      setNotifications((previous) => next
        ? [...previous, ...response.data.notifications.filter((n) => !previous.some((p) => p.id === n.id))]
        : response.data.notifications);
      setCursor(response.data.nextCursor);
      void refresh();
    } catch { if (request === generation.current) setError('Could not load notifications. Please try again.'); }
    finally { if (request === generation.current) setLoading(false); }
  }, [token, refresh]);
  useFocusEffect(useCallback(() => {
    void load();
    return () => { generation.current++; };
  }, [load]));
  const open = async (notification: AppNotification) => {
    if (!token || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError('');
    try {
      const response = await markNotificationReadRequest(notification.id, token);
      setNotifications((items) => items.map((n) => n.id === notification.id ? { ...n, readAt: response.data.readAt } : n));
      await refresh();
      if (!notification.target) { setError('This activity is no longer available to you.'); return; }
      // A stored target never proves current authorization.
      await fetchActivity(notification.target.activityId, token);
      navigation.navigate('Activity', { activityId: notification.target.activityId });
    } catch (failure: any) {
      setError([403, 404].includes(failure?.response?.status)
        ? 'This activity is no longer available to you.' : 'Could not open this notification. Please try again.');
    } finally { actionLock.current = false; setBusy(false); }
  };
  const readAll = async () => {
    if (!token || actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    setError('');
    try {
      await markAllNotificationsReadRequest(token);
      await load();
      await refresh();
    } catch { setError('Could not mark notifications as read. Please try again.'); }
    finally { actionLock.current = false; setBusy(false); }
  };
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.container} refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!busy) void load(); }} tintColor={colors.primary} />}>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.subtitle}>Updates for your activities.</Text>
        {notifications.some((n) => !n.readAt) ? <TouchableOpacity disabled={busy || loading} onPress={readAll} accessibilityRole="button"><Text style={styles.notificationTitle}>Mark all as read</Text></TouchableOpacity> : null}
        {error ? <View accessibilityLiveRegion="polite"><Text style={styles.notificationBody}>{error}</Text><TouchableOpacity disabled={loading || busy} onPress={() => void load()}><Text style={styles.notificationTitle}>Refresh</Text></TouchableOpacity></View> : null}
        {loading ? <ActivityIndicator color={colors.primary} /> : null}

        {notifications.length ? notifications.map((notification) => (
          <TouchableOpacity disabled={busy || loading} accessibilityRole="button" accessibilityLabel={`${notification.readAt ? 'Read' : 'Unread'}: ${notification.title}`} onPress={() => void open(notification)} key={notification.id} style={[styles.notificationCard, !notification.readAt && { borderColor: colors.primary }]}>
            <Text style={styles.notificationTitle}>{notification.title}</Text>
            {notification.activityTitle ? <Text style={styles.notificationBody}>{notification.activityTitle}</Text> : null}
            <Text style={styles.notificationBody}>{notification.body}</Text>
            <Text style={styles.subtitle}>{new Date(notification.createdAt).toLocaleString()}{!notification.readAt ? ' · Unread' : ''}</Text>
          </TouchableOpacity>
        )) : !loading && !error ? (
          <View style={styles.notificationCard}>
            <Text style={styles.notificationTitle}>No notifications yet</Text>
            <Text style={styles.notificationBody}>Updates about your activities and join requests will appear here.</Text>
          </View>
        ) : null}
        {cursor ? <TouchableOpacity disabled={loading || busy} onPress={() => void load(cursor)}><Text style={styles.notificationTitle}>Load more</Text></TouchableOpacity> : null}

        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Home')}>
          <Text style={styles.actionText}>Return to feed</Text>
        </TouchableOpacity>
      </ScrollView>
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    backgroundColor: colors.background,
    padding: spacing.xl,
    paddingBottom: 40,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  notificationCard: {
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notificationTitle: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  notificationBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: spacing.xl,
    backgroundColor: colors.primary,
    paddingVertical: 18,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionText: {
    color: colors.primaryText,
    fontWeight: '900',
    fontSize: 15,
  },
});
