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
  time?: string;
  distance?: string;
  vibe?: string;
  attendees?: number;
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
        <View>
          <Text style={styles.category}>{activity.category}</Text>
          <Text style={styles.vibe}>{activity.vibe || 'Premium'}</Text>
        </View>
        <Text style={styles.participantCount}>{activity.attendees ?? activity.participants.length} joined</Text>
      </View>
      <View style={styles.titleRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.meta}>{activity.date || 'Any day'} · {activity.time || 'Any time'} · {activity.distance || 'Nearby'}</Text>
        </View>
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
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#212121',
    padding: 24,
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
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  titleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  category: {
    color: '#f5c12d',
    fontWeight: '700',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  vibe: {
    color: '#ccc',
    fontSize: 12,
  },
  participantCount: {
    color: '#aaa',
    fontSize: 12,
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 8,
  },
  meta: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  description: {
    color: '#d1d1d1',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
