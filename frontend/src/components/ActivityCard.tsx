import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarBadge from './AvatarBadge';
import { getActivityCoverImage } from '../utils/activityAssets';

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
  maxAttendees?: number;
  coverImage?: string;
  availabilityTag?: string;
  participants: Array<{ name: string; avatar?: string }>;
  description: string;
};

type Props = {
  activity: Activity;
  onPress: () => void;
};

export default function ActivityCard({ activity, onPress }: Props) {
  const coverImage = activity.coverImage || getActivityCoverImage(activity.category, activity.id);
  const attendees = activity.attendees ?? activity.participants.length;
  const capacity = activity.maxAttendees ? `${attendees}/${activity.maxAttendees}` : `${attendees}`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.86}>
      <View style={styles.imageFrame}>
        <Image source={{ uri: coverImage }} style={styles.image} />
        <View style={styles.imageScrim} />
        {activity.availabilityTag && (
          <View style={styles.availabilityBadge}>
            <Text style={styles.availabilityText}>{activity.availabilityTag}</Text>
          </View>
        )}
        <View style={styles.hostPill}>
          <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={28} />
          <Text style={styles.hostName} numberOfLines={1}>
            {activity.host}
          </Text>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.categoryText}>{activity.category}</Text>
            <Text style={styles.title} numberOfLines={2}>
              {activity.title}
            </Text>
          </View>
          <View style={styles.vibeTag}>
            <Text style={styles.vibeText}>{activity.vibe || 'Social'}</Text>
          </View>
        </View>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#f5c12d" />
          <Text style={styles.location} numberOfLines={1}>
            {activity.location}
          </Text>
        </View>

        <View style={styles.metadata}>
          <View style={styles.metadataItem}>
            <Ionicons name="people-outline" size={15} color="#f5c12d" />
            <Text style={styles.metadataValue}>{capacity} going</Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons name="time-outline" size={15} color="#f5c12d" />
            <Text style={styles.metadataValue}>{activity.time || 'Anytime'}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Ionicons name="navigate-outline" size={15} color="#f5c12d" />
            <Text style={styles.metadataValue}>{activity.distance || 'Nearby'}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#101010',
    borderRadius: 10,
    overflow: 'hidden',
    marginHorizontal: 4,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#242018',
    elevation: 7,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.32,
    shadowRadius: 14,
  },
  imageFrame: {
    position: 'relative',
    width: '100%',
    height: 168,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  availabilityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#f5c12d',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  availabilityText: {
    color: '#050505',
    fontSize: 10,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  hostPill: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(5, 5, 5, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(245, 193, 45, 0.42)',
    padding: 4,
    paddingRight: 10,
    borderRadius: 999,
  },
  categoryText: {
    color: '#f5c12d',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  content: {
    padding: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  titleBlock: {
    flex: 1,
    paddingRight: 10,
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 22,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  location: {
    color: '#c9c9c9',
    fontSize: 13,
    marginLeft: 5,
    flex: 1,
  },
  metadata: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#242424',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 78,
  },
  metadataValue: {
    color: '#eeeeee',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 5,
  },
  vibeTag: {
    borderWidth: 1,
    borderColor: '#f5c12d',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
  },
  vibeText: {
    color: '#f5c12d',
    fontSize: 11,
    fontWeight: '800',
  },
  hostName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 7,
    flexShrink: 1,
  },
});
