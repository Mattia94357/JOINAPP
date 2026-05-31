import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import AvatarBadge from './AvatarBadge';
import { getAvatarUrl } from '../utils/avatar';

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
  const coverImage =
    activity.coverImage ||
    `https://via.placeholder.com/300x200/1a1a1a/f5c12d?text=${encodeURIComponent(activity.category)}`;
  const capacity = activity.maxAttendees ? `${activity.attendees}/${activity.maxAttendees}` : `${activity.attendees ?? 0} joined`;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      {/* Cover Image with Badges */}
      <View style={styles.imageContainer}>
        <Image source={{ uri: coverImage }} style={styles.image} />
        {activity.availabilityTag && (
          <View style={styles.availabilityBadge}>
            <Text style={styles.availabilityText}>{activity.availabilityTag}</Text>
          </View>
        )}
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{activity.category}</Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title} numberOfLines={2}>
          {activity.title}
        </Text>

        {/* Location */}
        <Text style={styles.location} numberOfLines={1}>
          📍 {activity.location}
        </Text>

        {/* Metadata Row */}
        <View style={styles.metadata}>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>🕐</Text>
            <Text style={styles.metadataValue}>{activity.time || 'Anytime'}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>📏</Text>
            <Text style={styles.metadataValue}>{activity.distance}</Text>
          </View>
          <View style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>👥</Text>
            <Text style={styles.metadataValue}>{capacity}</Text>
          </View>
        </View>

        {/* Vibe and Host */}
        <View style={styles.footer}>
          <View style={styles.vibeTag}>
            <Text style={styles.vibeText}>{activity.vibe || 'Social'}</Text>
          </View>
          <View style={styles.hostInfo}>
            <AvatarBadge
              name={activity.host}
              avatarUrl={activity.hostAvatar}
              size={24}
            />
            <Text style={styles.hostName} numberOfLines={1}>
              {activity.host}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#111111',
    borderRadius: 16,
    overflow: 'hidden',
    marginHorizontal: 16,
    marginVertical: 12,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  imageContainer: {
    position: 'relative',
    width: '100%',
    height: 180,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1a1a1a',
  },
  availabilityBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(245, 193, 45, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  availabilityText: {
    color: '#050505',
    fontSize: 11,
    fontWeight: '600',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  categoryText: {
    color: '#f5c12d',
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    padding: 14,
  },
  title: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
    lineHeight: 22,
  },
  location: {
    color: '#b8b8b8',
    fontSize: 13,
    marginBottom: 10,
  },
  metadata: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  metadataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  metadataLabel: {
    marginRight: 4,
    fontSize: 14,
  },
  metadataValue: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vibeTag: {
    backgroundColor: '#f5c12d',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    flex: 1,
    marginRight: 10,
  },
  vibeText: {
    color: '#050505',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  hostInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1.2,
  },
  hostName: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
  },
});
