import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
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
  onSkip?: () => void;
  onSave?: () => void;
  onOpenChat?: () => void;
  onViewParticipants?: (activity: Activity) => void;
  onOpenProfile?: (participant: { id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }) => void;
};

export default function ActivityCard({
  activity,
  onPress,
  onJoin,
  onSkip,
  onSave,
  onOpenChat,
  onViewParticipants,
  onOpenProfile,
}: Props) {
  const fallbackCoverImage = getActivityCoverImage(activity.category, activity.id);
  const [coverImage, setCoverImage] = useState(activity.coverImage || fallbackCoverImage);
  const attendees = activity.attendees ?? activity.participants.length;
  const spotsLeft = activity.maxAttendees ? Math.max(activity.maxAttendees - attendees, 0) : null;
  const visibleParticipants = activity.participants.slice(0, 4);
  const hostHostedCount = activity.hostHostedCount ?? 0;
  const hostJoinedCount = activity.hostJoinedCount ?? 0;
  const hostRating = activity.hostRating ? activity.hostRating.toFixed(1) : 'New';
  const curatedLabel = activity.visibility === 'private' ? 'Small group' : activity.availabilityTag?.toLowerCase().includes('tonight') ? 'Featured tonight' : 'Curated near you';
  const isClosed = activity.status === 'cancelled' || activity.status === 'completed';
  const isFull = activity.status === 'full' || spotsLeft === 0;
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
            : activity.visibility === 'private'
              ? 'Ask to Join'
              : activity.joinApproval === 'manual'
                ? 'Ask to Join'
              : 'Join Activity';

  return (
    <View style={styles.card}>
      {/* Card Pressable */}
      <TouchableOpacity onPress={onPress} activeOpacity={0.9}>
        {/* Cover Image */}
        <View style={styles.imageFrame}>
          <Image source={{ uri: coverImage }} style={styles.image} onError={() => setCoverImage(fallbackCoverImage)} />
          <View style={styles.imageOverlay} />

          {/* Top badges */}
          <View style={styles.topBadges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryText}>{activity.category}</Text>
            </View>
            {activity.availabilityTag && (
              <View style={styles.availabilityBadge}>
                <Text style={styles.availabilityText}>{activity.availabilityTag}</Text>
              </View>
            )}
            {activity.visibility === 'private' && (
              <View style={styles.privateBadge}>
                <Text style={styles.privateText}>Private</Text>
              </View>
            )}
            {activity.hostVerified && (
              <View style={styles.verifiedBadge}>
                <Text style={styles.verifiedText}>Verified host</Text>
              </View>
            )}
          </View>

          <View style={styles.curatedBadge}>
            <Ionicons name="star-outline" size={12} color={colors.primaryText} />
            <Text style={styles.curatedText}>{curatedLabel}</Text>
          </View>

          {/* Host Pill */}
          <TouchableOpacity
            style={styles.hostPill}
            activeOpacity={0.85}
            onPress={() =>
              onOpenProfile?.({ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar })
            }
          >
            <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={28} />
            <View style={styles.hostTextBlock}>
              <Text style={styles.hostLabel}>Hosted by</Text>
              <Text style={styles.hostName}>{activity.host}</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={2}>
            {activity.title}
          </Text>
          <Text style={styles.invitationCopy}>Meet through real activities</Text>
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.locationText}>{activity.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={14} color={colors.primary} />
            <Text style={styles.infoText}>{activity.time || 'Anytime'}</Text>
          </View>

          <View style={styles.participantRow}>
            <TouchableOpacity
              style={styles.participantsWrap}
              onPress={() => onViewParticipants?.(activity)}
            >
              <View style={styles.avatarStack}>
                {visibleParticipants.length
                  ? visibleParticipants.map((p, idx) => (
                      <TouchableOpacity
                        key={`${p.name}-${idx}`}
                        style={[styles.avatarWrapper, { marginLeft: idx === 0 ? 0 : -8 }]}
                        onPress={() => onOpenProfile?.(p)}
                      >
                        <AvatarBadge name={p.name} avatarUrl={p.avatar} size={28} />
                      </TouchableOpacity>
                    ))
                  : null}
              </View>
              <Text style={styles.spotsText}>
                {activity.participants.length ? `See who's going - ${attendees} going` : 'Be first to join'}
                {spotsLeft !== null ? ` - ${spotsLeft} spots left` : ''}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.credibilityRow}>
            <View style={styles.credibilityPill}>
              <Ionicons name="star-outline" size={13} color={colors.primary} />
              <Text style={styles.credibilityText}>{hostRating} rating</Text>
            </View>
            <View style={styles.credibilityPill}>
              <Ionicons name="calendar-outline" size={13} color={colors.primary} />
              <Text style={styles.credibilityText}>{hostHostedCount} hosted</Text>
            </View>
            <View style={styles.credibilityPill}>
              <Ionicons name="people-outline" size={13} color={colors.primary} />
              <Text style={styles.credibilityText}>{hostJoinedCount} joined</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Join / Chat / Details */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.joinButton, activity.joined && styles.joinedButton, (activity.pending || activity.declined || activity.waitlisted || isClosed) && styles.disabledButton]}
          onPress={activity.joined ? onOpenChat : onJoin}
          disabled={activity.pending || activity.declined || activity.waitlisted || isClosed}
        >
          <Ionicons
            name={activity.joined ? 'chatbubbles-outline' : 'checkmark-circle-outline'}
            size={18}
            color={colors.primaryText}
          />
          <Text style={styles.joinButtonText}>{primaryLabel}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveButton, activity.saved && styles.saveButtonActive]} onPress={onSave}>
          <Ionicons name={activity.saved ? 'bookmark' : 'bookmark-outline'} size={18} color={activity.saved ? colors.primaryText : colors.primary} />
        </TouchableOpacity>

        <TouchableOpacity style={styles.detailsButton} onPress={onPress}>
          <Text style={styles.detailsButtonText}>Details</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.shareRow}>
        <TouchableOpacity style={styles.shareButton} onPress={onSkip}>
          <Ionicons name="play-skip-forward-outline" size={15} color={colors.primary} />
          <Text style={styles.shareText}>Skip</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton} onPress={onPress}>
          <Ionicons name="share-outline" size={15} color={colors.primary} />
          <Text style={styles.shareText}>Share plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.shareButton} onPress={onPress}>
          <Ionicons name="person-add-outline" size={15} color={colors.primary} />
          <Text style={styles.shareText}>Invite a friend</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  imageFrame: { position: 'relative', width: '100%', height: 176 },
  image: { width: '100%', height: '100%', backgroundColor: colors.surfaceElevated, resizeMode: 'cover' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.24)' },
  topBadges: { position: 'absolute', top: 10, left: 10, right: 10, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  categoryBadge: { backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  categoryText: { color: colors.primary, fontWeight: '700', fontSize: 10, textTransform: 'uppercase' },
  availabilityBadge: { backgroundColor: colors.primary, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  availabilityText: { color: colors.primaryText, fontWeight: '700', fontSize: 10, textTransform: 'uppercase' },
  privateBadge: { backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.goldBorder, marginLeft: 6 },
  privateText: { color: colors.primary, fontWeight: '700', fontSize: 10, textTransform: 'uppercase' },
  verifiedBadge: { backgroundColor: colors.goldWash, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: colors.goldBorder, marginLeft: 6 },
  verifiedText: { color: colors.primary, fontWeight: '800', fontSize: 10, textTransform: 'uppercase' },
  curatedBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  curatedText: { color: colors.primaryText, fontSize: 11, fontWeight: '900', marginLeft: 4 },
  hostPill: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 5,
    paddingRight: 10,
    borderRadius: 999,
  },
  hostTextBlock: { marginLeft: 6 },
  hostLabel: { color: colors.textMuted, fontSize: 9, fontWeight: '700' },
  hostName: { color: colors.text, fontSize: 12, fontWeight: '900' },
  content: { padding: spacing.md },
  title: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 6 },
  invitationCopy: { color: colors.primary, fontSize: 12, fontWeight: '900', marginBottom: 8 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  locationText: { color: colors.textMuted, fontSize: 12, marginLeft: 4, fontWeight: '700' },
  infoText: { color: colors.textMuted, fontSize: 12, marginLeft: 4 },
  participantRow: { marginTop: 8 },
  participantsWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  avatarStack: { flexDirection: 'row', alignItems: 'center' },
  avatarWrapper: { borderWidth: 1, borderColor: colors.surface, borderRadius: 999 },
  spotsText: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginLeft: 8 },
  credibilityRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  credibilityPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginRight: 6,
    marginBottom: 6,
    backgroundColor: colors.surfaceSoft,
  },
  credibilityText: { color: colors.textMuted, fontSize: 11, fontWeight: '800', marginLeft: 4 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  joinButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  joinedButton: { backgroundColor: colors.primary },
  disabledButton: { opacity: 0.68 },
  joinButtonText: { color: colors.primaryText, fontWeight: '900', marginLeft: 6 },
  saveButton: {
    width: 46,
    marginLeft: spacing.sm,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  detailsButton: { borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center' },
  detailsButtonText: { color: colors.text, fontWeight: '900' },
  shareRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  shareButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  shareText: { color: colors.textMuted, fontSize: 12, fontWeight: '900', marginLeft: 5 },
});
