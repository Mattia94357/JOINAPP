import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AvatarBadge from './AvatarBadge';

export type Activity = {
  id: string;
  title: string;
  category: string;
  location: string;
  host: string;
  hostId: string;
  hostAvatar?: string;
  date?: string;
  participants: Array<{ name: string; avatar?: string }>;
  description: string;
};

type Props = {
  activity: Activity;
  onPress: () => void;
};

export default function ActivityCard({ activity, onPress }: Props) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <View style={styles.headerTop}>
        <Text style={styles.category}>{activity.category}</Text>
        <Text style={styles.participantCount}>{activity.participants.length} joined</Text>
      </View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>{activity.title}</Text>
        <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={48} />
      </View>
      <Text style={styles.description}>{activity.description}</Text>
      <View style={styles.footer}>
        <Text style={styles.location}>{activity.location}</Text>
        <Text style={styles.host}>Host: {activity.host}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#333',
    padding: 22,
    marginBottom: 18,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  category: {
    color: '#f5c12d',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  participantCount: {
    color: '#ccc',
    fontSize: 12,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  description: {
    color: '#ccc',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  location: {
    color: '#eee',
    fontSize: 14,
  },
  host: {
    color: '#f5c12d',
    fontWeight: '700',
    fontSize: 14,
  },
});
