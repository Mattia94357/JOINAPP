import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const notifications: Array<{ title: string; body: string }> = [];

export default function NotificationsScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>Real-time updates for your upcoming experiences.</Text>

      {notifications.length ? notifications.map((notification, index) => (
        <View key={index} style={styles.notificationCard}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationBody}>{notification.body}</Text>
        </View>
      )) : (
        <View style={styles.notificationCard}>
          <Text style={styles.notificationTitle}>No notifications yet</Text>
          <Text style={styles.notificationBody}>Updates about joined activities, chat messages, and requests will appear here.</Text>
        </View>
      )}

      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.actionText}>Return to feed</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
