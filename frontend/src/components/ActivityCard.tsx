import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
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
  const visibleParticipants = activity.participants.slice(0, 4);
  const previewPeople = visibleParticipants.length
    ? visibleParticipants
    : [{ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar }];
  const isClosed = activity.status === 'cancelled' || activity.status === 'completed';
  const isFull = activity.status === 'full' || spotsLeft === 0;
  const imageHeight = Math.min(620, Math.max(450, height - 220));
  const statusBadge = activity.visibility === 'private'
    ? 'Private'
    : spotsLeft !== null
      ? `${spotsLeft} spots`
      : `${attendees} going`;
  const primaryLabel = activity.joined
    ? 'Open Chat'
    : activity.declined
      ? 'Request Declined'
      : activity.pending
        ? 'Request Pending'
        : activity.waitlisted
          ? 'On Waitlist'
          : isClosed
            ? 'Unavailable'
            : isFull
              ? 'Join Waitlist'
              : activity.visibility === 'private' || activity.joinApproval === 'manual'
                ? 'Ask to Join'
                : 'Join Activity';

  return (
    <View style={styles.card}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.94}>
        <View style={[styles.imageFrame, { height: imageHeight }]}>
          <Image source={{ uri: coverImage }} style={styles.image} onError={() => setCoverImage(fallbackCoverImage)} />
          <View style={styles.imageScrim} />
          <View style={styles.bottomGradient} />

          <View style={styles.topBadges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText} numberOfLines={1}>{activity.category}</Text>
            </View>
            {activity.availabilityTag ? (
              <View style={styles.availabilityBadge}>
                <Text style={styles.availabilityText} numberOfLines={1}>{activity.availabilityTag}</Text>
              </View>
            ) : null}
            <View style={styles.statusBadge}>
              <Text style={styles.statusBadgeText} numberOfLines={1}>{statusBadge}</Text>
            </View>
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
                <Text style={styles.hostLabel}>Host</Text>
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
              </View>
              <View style={styles.participantCopy}>
                <Text style={styles.participantLabel}>See who's going</Text>
                <Text style={styles.participantText} numberOfLines={1}>
                  {activity.participants.length ? `${attendees} going` : 'Be first to join'}
                  {spotsLeft !== null ? ` - ${spotsLeft} spots left` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.detailsButton} onPress={onPress} activeOpacity={0.82}>
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.joinButton, activity.joined && styles.joinedButton, (activity.pending || activity.declined || activity.waitlisted || isClosed) && styles.disabledButton]}
          onPress={activity.joined ? onOpenChat : onJoin}
          disabled={activity.pending || activity.declined || activity.waitlisted || isClosed}
          activeOpacity={0.84}
        >
          <Ionicons name={activity.joined ? 'chatbubbles-outline' : 'checkmark-circle-outline'} size={20} color={colors.primaryText} />
          <Text style={styles.joinButtonText} numberOfLines={1}>{primaryLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.iconActionButton, activity.saved && styles.iconActionButtonActive]} onPress={onSave} activeOpacity={0.78}>
          <Ionicons name={activity.saved ? 'bookmark' : 'bookmark-outline'} size={24} color={activity.saved ? colors.primaryText : colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
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
  },
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
  statusBadge: {
    marginLeft: 'auto',
    backgroundColor: 'rgba(0,0,0,0.62)',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  statusBadgeText: {
    color: colors.text,
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
    fontSize: 27,
    fontWeight: '900',
    lineHeight: 32,
    marginBottom: 12,
    textShadowColor: 'rgba(0,0,0,0.42)',
    textShadowRadius: 8,
    textShadowOffset: { width: 0, height: 2 },
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    minHeight: 46,
  },
  hostCopy: {
    flex: 1,
    marginLeft: 10,
  },
  hostLabel: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  hostText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
    marginBottom: 12,
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
  participantCopy: {
    flex: 1,
    marginLeft: 12,
  },
  participantLabel: {
    color: colors.primary,
    fontSize: 10,
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
    gap: 10,
    marginTop: 18,
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  iconActionButton: {
    width: 60,
    height: 60,
    borderRadius: 20,
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
    minWidth: 110,
    height: 60,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 20,
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
    flex: 1,
    height: 60,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 20,
    paddingHorizontal: 12,
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
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
