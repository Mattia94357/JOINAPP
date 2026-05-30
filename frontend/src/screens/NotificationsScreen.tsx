import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

const notifications = [
  {
    title: 'New activity nearby',
    body: 'Sunset rooftop dinner is now open for RSVP at 7:30 PM.',
  },
  {
    title: 'Booking confirmed',
    body: 'You’ve secured a spot in the Creative co-working lounge.',
  },
  {
    title: 'Host message',
    body: 'Jordan updated the hike route to make it more scenic.',
  },
];

export default function NotificationsScreen({ navigation }: Props) {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Notifications</Text>
      <Text style={styles.subtitle}>Real-time updates for your upcoming experiences.</Text>

      {notifications.map((notification, index) => (
        <View key={index} style={styles.notificationCard}>
          <Text style={styles.notificationTitle}>{notification.title}</Text>
          <Text style={styles.notificationBody}>{notification.body}</Text>
        </View>
      ))}

      <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Home')}>
        <Text style={styles.actionText}>Return to feed</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050505',
    padding: 22,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 8,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 15,
    marginBottom: 24,
    lineHeight: 22,
  },
  notificationCard: {
    backgroundColor: '#111',
    borderRadius: 20,
    padding: 22,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#222',
  },
  notificationTitle: {
    color: '#f5c12d',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 10,
  },
  notificationBody: {
    color: '#ddd',
    fontSize: 14,
    lineHeight: 20,
  },
  actionButton: {
    marginTop: 24,
    backgroundColor: '#f5c12d',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
  },
  actionText: {
    color: '#050505',
    fontWeight: '700',
    fontSize: 15,
  },
});
