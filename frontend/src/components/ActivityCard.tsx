import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarBadge from './AvatarBadge';
import { getActivityCoverImage } from '../utils/activityAssets';
import { colors, spacing } from '../theme';

export type Activity = {
  id: string;
  title: string;
  category: string;
  location: string;
  host: string;
  hostId: string;
  hostAvatar?: string;
  hostRating?: number;
  hostHostedCount?: number;
  hostJoinedCount?: number;
  hostReviewCount?: number;
  hostVerified?: boolean;
  time?: string;
  distance?: string;
  vibe?: string;
  attendees?: number;
  maxAttendees?: number;
  coverImage?: string;
  availabilityTag?: string;
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  visibility?: 'public' | 'private';
  joinApproval?: 'auto' | 'manual';
  participants: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }>;
  description: string;
  joined?: boolean;
  pending?: boolean;
  declined?: boolean;
  waitlisted?: boolean;
  saved?: boolean;
  chatId?: string;
};

type Props = {
  activity: Activity;
  onPress: () => void;
  onJoin?: () => void;
  onSave?: () => void;
  onOpenChat?: () => void;
  onViewParticipants?: (activity: Activity) => void;
  onOpenProfile?: (participant: { id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }) => void;
};

export default function ActivityCard({
  activity,
  onPress,
  onJoin,
  onSave,
  onOpenChat,
  onViewParticipants,
  onOpenProfile,
}: Props) {
  const { height } = useWindowDimensions();
  const fallbackCoverImage = getActivityCoverImage(activity.category, activity.id);
  const [coverImage, setCoverImage] = useState(activity.coverImage || fallbackCoverImage);
  const attendees = activity.attendees ?? activity.participants.length;
  const spotsLeft = activity.maxAttendees ? Math.max(activity.maxAttendees - attendees, 0) : null;
  const visibleParticipants = activity.participants.slice(0, 3);
  const hiddenParticipantCount = Math.max(0, attendees - visibleParticipants.length);
  const actionScale = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 340, useNativeDriver: true }).start();
  }, [entrance]);
  const previewPeople = visibleParticipants.length
    ? visibleParticipants
    : [{ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar }];
  const isClosed = activity.status === 'cancelled' || activity.status === 'completed';
  const isFull = activity.status === 'full' || spotsLeft === 0;
  const imageHeight = Math.min(640, Math.max(470, height - 210));
  const primaryLabel = activity.joined ? 'CHAT' : 'JOIN';
  const categoryIcon = activity.category === 'Food' ? '🍴' : activity.category === 'Wellness' ? '✦' : activity.category === 'Adventure' ? '◈' : activity.category === 'Music' ? '♪' : activity.category === 'Nightlife' ? '✧' : '•';
  const animateAction = (toValue: number, duration: number) => Animated.timing(actionScale, { toValue, duration, useNativeDriver: true }).start();

  return (
    <Animated.View style={[styles.card, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
      <Animated.View style={{ transform: [{ scale: cardScale }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={() => Animated.timing(cardScale, { toValue: 0.985, duration: 100, useNativeDriver: true }).start()}
        onPressOut={() => Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, friction: 7 }).start()}
        activeOpacity={0.96}
      >
        <View style={[styles.imageFrame, { height: imageHeight }]}>
          <Image source={{ uri: coverImage }} style={styles.image} onError={() => setCoverImage(fallbackCoverImage)} />
          <View style={styles.imageScrim} />
          <View style={styles.bottomGradient} />

          <View style={styles.topBadges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryIcon}>{categoryIcon}</Text>
              <Text style={styles.categoryText} numberOfLines={1}>{activity.category}</Text>
            </View>
            {activity.availabilityTag ? (
              <View style={styles.availabilityBadge}>
                <Text style={styles.availabilityText} numberOfLines={1}>{activity.availabilityTag}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.imageCopy}>
            <Text style={styles.title} numberOfLines={2}>{activity.title}</Text>

            <TouchableOpacity
              style={styles.hostRow}
              activeOpacity={0.85}
              onPress={() => onOpenProfile?.({ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar })}
            >
              <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={42} />
              <View style={styles.hostCopy}>
                <Text style={styles.hostLabel}>HOSTED BY</Text>
                <Text style={styles.hostText} numberOfLines={1}>{activity.host}</Text>
              </View>
              <Ionicons name="chevron-forward-outline" size={16} color={colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.metaLine}>
              <Ionicons name="location-outline" size={14} color={colors.primary} />
              <Text style={styles.metaText} numberOfLines={1}>{activity.location}</Text>
              <Text style={styles.metaDot}>-</Text>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={styles.metaText} numberOfLines={1}>{activity.time || 'Anytime'}</Text>
            </View>

            <TouchableOpacity style={styles.participantsWrap} onPress={() => onViewParticipants?.(activity)} activeOpacity={0.85}>
              <View style={styles.avatarStack}>
                {previewPeople.map((p, idx) => (
                    <TouchableOpacity
                      key={`${p.name}-${idx}`}
                      style={[styles.avatarWrapper, { marginLeft: idx === 0 ? 0 : -8 }]}
                      onPress={() => onOpenProfile?.(p)}
                    >
                      <AvatarBadge name={p.name} avatarUrl={p.avatar || p.profileThumbnailUrl || p.profilePictureUrl} size={40} />
                    </TouchableOpacity>
                  ))}
                {hiddenParticipantCount > 0 ? (
                  <View style={[styles.morePeople, { marginLeft: previewPeople.length ? -8 : 0 }]}>
                    <Text style={styles.morePeopleText}>+{hiddenParticipantCount}</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.participantCopy}>
                <Text style={styles.participantLabel}>Going together</Text>
                <Text style={styles.participantText} numberOfLines={1}>
                  {activity.participants.length ? `${attendees} people going` : 'Be the first to join'}
                  {spotsLeft !== null ? ` · ${spotsLeft} spots left` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
      </Animated.View>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.detailsButton} onPress={onPress} activeOpacity={0.82}>
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.joinButtonWrap, { transform: [{ scale: actionScale }] }]}>
          <TouchableOpacity
            style={[styles.joinButton, activity.joined && styles.joinedButton, (activity.pending || activity.declined || activity.waitlisted || isClosed) && styles.disabledButton]}
            onPress={activity.joined ? onOpenChat : onJoin}
            onPressIn={() => animateAction(0.96, 90)}
            onPressOut={() => Animated.spring(actionScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }).start()}
            disabled={activity.pending || activity.declined || activity.waitlisted || isClosed}
            activeOpacity={0.92}
          >
            <Ionicons name={activity.joined ? 'chatbubbles-outline' : 'person-add-outline'} size={19} color={colors.primaryText} />
            <Text style={styles.joinButtonText} numberOfLines={1}>{primaryLabel}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: bookmarkScale }] }}>
          <TouchableOpacity
            style={[styles.iconActionButton, activity.saved && styles.iconActionButtonActive]}
            onPress={() => {
              Animated.sequence([
                Animated.timing(bookmarkScale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
                Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, friction: 3 }),
              ]).start();
              onSave?.();
            }}
            activeOpacity={0.78}
          >
            <Ionicons name={activity.saved ? 'bookmark' : 'bookmark-outline'} size={23} color={activity.saved ? colors.primaryText : colors.primary} />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    marginVertical: 2,
  },
  imageFrame: {
    position: 'relative',
    width: '100%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: 26,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.38,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 18 },
    elevation: 12,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceElevated,
    resizeMode: 'cover',
  },
  imageScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 255,
    backgroundColor: 'rgba(0,0,0,0.68)',
  },
  topBadges: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    maxWidth: '38%',
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryIcon: { marginRight: 5, color: colors.primary, fontSize: 11 },
  categoryText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  availabilityBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    marginLeft: 7,
    maxWidth: '32%',
  },
  availabilityText: {
    color: colors.primaryText,
    fontWeight: '900',
    fontSize: 10,
    textTransform: 'uppercase',
  },
  imageCopy: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 29,
    fontWeight: '900',
    lineHeight: 32,
    marginBottom: 14,
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    minHeight: 46,
  },
  hostCopy: {
    flex: 1,
    marginLeft: 10,
  },
  hostLabel: {
    color: 'rgba(255,255,255,0.58)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  hostText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
    marginBottom: 14,
  },
  metaText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 5,
    flexShrink: 1,
  },
  metaDot: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '900',
    marginHorizontal: 8,
  },
  participantsWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderWidth: 1,
    borderColor: colors.background,
    borderRadius: 999,
  },
  morePeople: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(11,11,11,0.9)',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePeopleText: { color: colors.primaryText, fontSize: 11, fontWeight: '900' },
  participantCopy: {
    flex: 1,
    marginLeft: 12,
  },
  participantLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  participantText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  iconActionButton: {
    width: 54,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(22,22,22,0.96)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  iconActionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  detailsButton: {
    width: 82,
    height: 58,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(22,22,22,0.96)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  detailsButtonText: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 15,
  },
  joinButton: {
    width: '100%',
    height: 58,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  joinButtonWrap: { flex: 1, shadowColor: colors.primary, shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
  joinedButton: {
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.68,
  },
  joinButtonText: {
    color: colors.primaryText,
    fontWeight: '900',
    fontSize: 15,
    marginLeft: 7,
    flexShrink: 1,
  },
});
