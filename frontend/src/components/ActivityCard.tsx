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
  participants: Array<{ id?: string; name: string; avatar?: string }>;
  description: string;
  joined?: boolean;
  chatId?: string;
};

type Props = {
  activity: Activity;
  onPress: () => void;
  onJoinActivity?: () => void;
  onOpenChat?: () => void;
  onViewParticipants?: (activity: Activity) => void;
  onOpenProfile?: (participant: { id?: string; name: string; avatar?: string }) => void;
};

export default function ActivityCard({
  activity,
  onPress,
  onJoinActivity,
  onOpenChat,
  onViewParticipants,
  onOpenProfile,
}: Props) {
  const coverImage = activity.coverImage || getActivityCoverImage(activity.category, activity.id);
  const attendees = activity.attendees ?? activity.participants.length;
  const spotsLeft =
    activity.maxAttendees && activity.maxAttendees > attendees
      ? activity.maxAttendees - attendees
      : null;

  const visibleParticipants = activity.participants.slice(0, 4);
  const extraParticipants = Math.max(activity.participants.length - visibleParticipants.length, 0);

  const handleJoinPress = () => {
    if (activity.joined && onOpenChat) {
      onOpenChat();
      return;
    }

    if (onJoinActivity) {
      onJoinActivity();
    }
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.imageFrame}>
        <Image source={{ uri: coverImage }} style={styles.image} />
        <View style={styles.imageScrim} />

        <View style={styles.topBadges}>
          <View style={styles.goldBadge}>
            <Ionicons name="time-outline" size={12} color="#050505" />
            <Text style={styles.goldBadgeText}>{activity.time || 'Anytime'}</Text>
          </View>

          {activity.vibe ? (
            <View style={styles.darkBadge}>
              <Text style={styles.darkBadgeText}>{activity.vibe}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.hostPill}>
          <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={28} />
          <View style={styles.hostTextBlock}>
            <Text style={styles.hostLabel}>Hosted by</Text>
            <Text style={styles.hostName} numberOfLines={1}>
              {activity.host}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <Text style={styles.categoryText}>{activity.category}</Text>

        <Text style={styles.title} numberOfLines={2}>
          {activity.title}
        </Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color="#f5c12d" />
          <Text style={styles.location} numberOfLines={1}>
            {activity.location}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={15} color="#f5c12d" />
            <Text style={styles.metaText}>{attendees} going</Text>
          </View>

          <View style={styles.metaItem}>
            <Ionicons name="navigate-outline" size={15} color="#f5c12d" />
            <Text style={styles.metaText}>{activity.distance || 'Nearby'}</Text>
          </View>

          {spotsLeft !== null ? (
            <View style={styles.metaItem}>
              <Ionicons name="ticket-outline" size={15} color="#f5c12d" />
              <Text style={styles.metaText}>{spotsLeft} spots left</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity
          style={styles.participantsRow}
          onPress={() => onViewParticipants?.(activity)}
          activeOpacity={0.8}
        >
          <View