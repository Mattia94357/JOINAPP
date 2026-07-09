import React, { useEffect, useRef, useState } from 'react';
import { Animated, Image, Linking, Modal, Platform, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarBadge from './AvatarBadge';
import Logo from './Logo';
import { getActivityCoverImage } from '../utils/activityAssets';
import { colors } from '../theme';

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
  onOpenLocation?: (activity: Activity) => void;
};

const categoryGlyph = (category: string) => {
  if (category === 'Food') return 'restaurant-outline';
  if (category === 'Drinks') return 'wine-outline';
  if (category === 'Outdoors') return 'trail-sign-outline';
  if (category === 'Wellness') return 'sparkles-outline';
  if (category === 'Adventure') return 'compass-outline';
  if (category === 'Music') return 'musical-notes-outline';
  if (category === 'Nightlife') return 'moon-outline';
  return 'ellipse-outline';
};

const locationCoordinates: Record<string, { lat: number; lng: number }> = {
  'Perth CBD': { lat: -31.9523, lng: 115.8613 },
  Perth: { lat: -31.9523, lng: 115.8613 },
  'Cottesloe Beach': { lat: -31.994, lng: 115.751 },
  Northbridge: { lat: -31.9475, lng: 115.8587 },
  Subiaco: { lat: -31.9486, lng: 115.8247 },
  'Matilda Bay': { lat: -31.9814, lng: 115.821 },
  Fremantle: { lat: -32.0569, lng: 115.7439 },
  Leederville: { lat: -31.9367, lng: 115.8416 },
  'Kings Park': { lat: -31.9609, lng: 115.8321 },
  Scarborough: { lat: -31.8958, lng: 115.7571 },
  'Elizabeth Quay': { lat: -31.9596, lng: 115.8575 },
};

const getMapCoordinates = (location: string) => {
  const normalized = location.trim().toLowerCase();
  const match = Object.entries(locationCoordinates).find(([key]) => normalized.includes(key.toLowerCase()));
  return match?.[1] || locationCoordinates['Perth CBD'];
};

const getStaticMapUrl = (location: string) => {
  const { lat, lng } = getMapCoordinates(location);
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=13&size=640x360&maptype=mapnik&markers=${lat},${lng},lightblue1`;
};

export default function ActivityCard({
  activity,
  onPress,
  onJoin,
  onSave,
  onOpenChat,
  onViewParticipants,
  onOpenProfile,
  onOpenLocation,
}: Props) {
  const { height, width } = useWindowDimensions();
  const fallbackCoverImage = getActivityCoverImage(activity.category, activity.id);
  const [coverImage, setCoverImage] = useState(activity.coverImage || fallbackCoverImage);
  const attendees = activity.attendees ?? activity.participants.length;
  const spotsLeft = activity.maxAttendees ? Math.max(activity.maxAttendees - attendees, 0) : null;
  const visibleParticipants = activity.participants.slice(0, 3);
  const hiddenParticipantCount = Math.max(0, attendees - visibleParticipants.length);
  const previewPeople = visibleParticipants.length
    ? visibleParticipants
    : [{ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar }];
  const isClosed = activity.status === 'cancelled' || activity.status === 'completed';
  const actionScale = useRef(new Animated.Value(1)).current;
  const cardScale = useRef(new Animated.Value(1)).current;
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const [locationModalVisible, setLocationModalVisible] = useState(false);
  const compact = width < 520;
  const shortViewport = height < 760;
  const heroHeight = Math.min(
    compact ? 560 : 660,
    Math.max(compact ? (shortViewport ? 430 : 500) : 590, height - (compact ? 330 : 260)),
  );
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`;
  const mapPreviewUrl = getStaticMapUrl(activity.location);

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [entrance]);

  const animateAction = (toValue: number, duration: number) =>
    Animated.timing(actionScale, { toValue, duration, useNativeDriver: true }).start();

  const openLocationModal = () => {
    if (onOpenLocation) {
      onOpenLocation(activity);
      return;
    }
    setLocationModalVisible(true);
  };

  const openMaps = () => {
    Linking.openURL(mapsUrl).catch(() => undefined);
  };

  return (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
      }}
    >
      <Animated.View style={{ transform: [{ scale: cardScale }] }}>
        <View style={[styles.card, styles.imageFrame, { height: heroHeight }]}>
            <Image source={{ uri: coverImage }} style={styles.image} onError={() => setCoverImage(fallbackCoverImage)} />
            <View style={styles.imageWarmth} />
            <View style={styles.bottomScrim} />

            <View style={styles.categoryBadge}>
              <Ionicons name={categoryGlyph(activity.category) as any} size={compact ? 17 : 20} color={colors.primary} />
              <Text style={[styles.categoryText, compact && styles.categoryTextCompact]} numberOfLines={1}>{activity.category}</Text>
            </View>

            <View style={[styles.imageCopy, compact && styles.imageCopyCompact]}>
              <Text style={[styles.title, compact && styles.titleCompact]} numberOfLines={1}>{activity.title}</Text>

              <TouchableOpacity
                style={styles.hostRow}
                activeOpacity={0.85}
                onPress={() => onOpenProfile?.({ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar })}
              >
              <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={compact ? 34 : 40} />
                <View style={styles.hostCopy}>
                  <Text style={styles.hostLabel}>HOSTED BY</Text>
                <Text style={[styles.hostText, compact && styles.hostTextCompact]} numberOfLines={1}>{activity.host}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.metaLine}
                onPress={openLocationModal}
                onStartShouldSetResponder={() => true}
                onResponderRelease={openLocationModal}
                {...(Platform.OS === 'web' ? ({ onClick: openLocationModal } as any) : {})}
                activeOpacity={0.78}
              >
                <View style={styles.locationPressable}>
                  <Ionicons name="location-outline" size={compact ? 17 : 20} color={colors.primary} />
                  <Text
                    style={[styles.metaText, compact && styles.metaTextCompact]}
                    numberOfLines={1}
                    onPress={openLocationModal}
                    {...(Platform.OS === 'web' ? ({ onClick: openLocationModal } as any) : {})}
                  >
                    {activity.location}
                  </Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.timeMeta}>
                  <Ionicons name="time-outline" size={compact ? 17 : 20} color={colors.primary} />
                  <Text style={[styles.metaText, compact && styles.metaTextCompact]} numberOfLines={1}>{activity.time || 'Anytime'}</Text>
                </View>
              </TouchableOpacity>

              <View style={styles.divider} />

              <View style={styles.aboutRow}>
                <Text style={styles.aboutLabel}>ABOUT THIS ACTIVITY</Text>
                <Text style={[styles.aboutText, compact && styles.aboutTextCompact]} numberOfLines={1} ellipsizeMode="tail">
                  {activity.description}
                </Text>
              </View>

              <TouchableOpacity style={styles.peopleRow} onPress={() => onViewParticipants?.(activity)} activeOpacity={0.86}>
                <View style={styles.avatarStack}>
                  {previewPeople.map((participant, index) => (
                    <TouchableOpacity
                      key={`${participant.name}-${index}`}
                      style={[styles.avatarWrapper, { marginLeft: index === 0 ? 0 : -12 }]}
                      onPress={() => onOpenProfile?.(participant)}
                      activeOpacity={0.82}
                    >
                      <AvatarBadge
                        name={participant.name}
                        avatarUrl={participant.avatar || participant.profileThumbnailUrl || participant.profilePictureUrl}
                        size={compact ? 30 : 34}
                      />
                    </TouchableOpacity>
                  ))}
                  {hiddenParticipantCount > 0 ? (
                    <View style={[styles.morePeople, compact && styles.morePeopleCompact, { marginLeft: -12 }]}>
                      <Text style={styles.morePeopleText}>+{hiddenParticipantCount}</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.peopleCopy}>
                  <Text style={styles.peopleLabel}>GOING TOGETHER</Text>
                  <Text style={[styles.peopleText, compact && styles.peopleTextCompact]} numberOfLines={1}>
                    {activity.participants.length ? `${attendees} people going` : 'Be the first to join'}
                    {spotsLeft !== null ? `  •  ${spotsLeft} spots left` : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward-outline" size={compact ? 22 : 26} color={colors.text} />
              </TouchableOpacity>
            </View>
          </View>
      </Animated.View>

      <View style={[styles.actionBar, compact && styles.actionBarCompact]}>
        <TouchableOpacity style={[styles.detailsButton, compact && styles.detailsButtonCompact]} onPress={onPress} activeOpacity={0.82}>
          <Ionicons name="information-circle-outline" size={compact ? 18 : 21} color={colors.text} />
          <Text style={[styles.detailsButtonText, compact && styles.detailsButtonTextCompact]}>Details</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.joinButtonWrap, { transform: [{ scale: actionScale }] }]}>
          <TouchableOpacity
            style={[
              styles.joinButton,
              compact && styles.joinButtonCompact,
              activity.joined && styles.joinedButton,
              (activity.pending || activity.declined || activity.waitlisted || isClosed) && styles.disabledButton,
            ]}
            onPress={activity.joined ? onOpenChat : onJoin}
            onPressIn={() => animateAction(0.96, 90)}
            onPressOut={() => Animated.spring(actionScale, { toValue: 1, useNativeDriver: true, friction: 4, tension: 120 }).start()}
            disabled={activity.pending || activity.declined || activity.waitlisted || isClosed}
            activeOpacity={0.92}
          >
            <Logo size={compact ? 30 : 34} style={styles.joinLogo} />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.bookmarkButtonWrap, { transform: [{ scale: bookmarkScale }] }]}>
          <TouchableOpacity
            style={[styles.bookmarkButton, compact && styles.bookmarkButtonCompact, activity.saved && styles.bookmarkButtonActive]}
            onPress={() => {
              Animated.sequence([
                Animated.timing(bookmarkScale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
                Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, friction: 3 }),
              ]).start();
              onSave?.();
            }}
            activeOpacity={0.78}
          >
            <Ionicons name={activity.saved ? 'bookmark' : 'bookmark-outline'} size={compact ? 24 : 28} color={activity.saved ? colors.primaryText : colors.primary} />
          </TouchableOpacity>
        </Animated.View>
      </View>

      <Modal
        visible={locationModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLocationModalVisible(false)}
      >
        <View style={styles.mapModalOverlay}>
          <View style={styles.mapModal}>
            <View style={styles.mapModalHeader}>
              <View style={styles.mapModalTitleBlock}>
                <Text style={styles.mapModalEyebrow}>LOCATION</Text>
                <Text style={styles.mapModalTitle} numberOfLines={2}>{activity.location}</Text>
              </View>
              <TouchableOpacity style={styles.mapCloseButton} onPress={() => setLocationModalVisible(false)} activeOpacity={0.78}>
                <Ionicons name="close-outline" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={styles.mapPreview}>
              <Image source={{ uri: mapPreviewUrl }} style={styles.mapPreviewImage} />
              <View style={styles.mapPreviewTint} />
              <View style={styles.mapPin}>
                <Ionicons name="location" size={28} color={colors.primaryText} />
              </View>
              <View style={styles.mapPreviewLabel}>
                <Text style={styles.mapPreviewText} numberOfLines={1}>{activity.location}</Text>
              </View>
            </View>
            <View style={styles.addressBlock}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
              <Text style={styles.addressText} numberOfLines={2}>{activity.location}</Text>
            </View>
            <TouchableOpacity style={styles.openMapsButton} onPress={openMaps} activeOpacity={0.86}>
              <Ionicons name={Platform.OS === 'ios' ? 'map-outline' : 'navigate-outline'} size={18} color={colors.primaryText} />
              <Text style={styles.openMapsText}>Open in Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#101010',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.52)',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 14,
  },
  imageFrame: {
    width: '100%',
    position: 'relative',
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
    backgroundColor: colors.surfaceElevated,
  },
  imageWarmth: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(40,28,10,0.08)',
  },
  bottomScrim: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '52%',
    backgroundColor: 'rgba(0,0,0,0.54)',
  },
  categoryBadge: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(26,22,16,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.16)',
  },
  categoryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginLeft: 9,
    textTransform: 'uppercase',
  },
  categoryTextCompact: {
    fontSize: 12,
  },
  imageCopy: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 22,
  },
  imageCopyCompact: {
    left: 20,
    right: 20,
    bottom: 20,
  },
  title: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '900',
    letterSpacing: -0.8,
    marginBottom: 11,
    textShadowColor: 'rgba(0,0,0,0.52)',
    textShadowRadius: 10,
    textShadowOffset: { width: 0, height: 3 },
  },
  titleCompact: {
    fontSize: 23,
    lineHeight: 27,
    marginBottom: 11,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    marginBottom: 11,
  },
  hostCopy: {
    flex: 1,
    marginLeft: 9,
  },
  hostLabel: {
    color: 'rgba(245,238,224,0.7)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  hostText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  hostTextCompact: {
    fontSize: 13,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 22,
    marginBottom: 8,
  },
  locationPressable: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
  },
  metaText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 7,
    flexShrink: 1,
  },
  metaTextCompact: {
    fontSize: 13,
  },
  metaDot: {
    color: 'rgba(245,238,224,0.7)',
    fontSize: 14,
    fontWeight: '900',
    marginHorizontal: 9,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(246,196,69,0.24)',
    marginBottom: 12,
  },
  aboutRow: {
    marginBottom: 13,
  },
  aboutLabel: {
    color: 'rgba(245,238,224,0.58)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 4,
  },
  aboutText: {
    color: 'rgba(245,238,224,0.88)',
    fontSize: 12,
    fontWeight: '800',
  },
  aboutTextCompact: {
    fontSize: 11,
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
  },
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrapper: {
    borderWidth: 1,
    borderColor: '#0B0B0B',
    borderRadius: 999,
  },
  morePeople: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    borderColor: '#0B0B0B',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePeopleCompact: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  morePeopleText: {
    color: colors.primaryText,
    fontSize: 12,
    fontWeight: '900',
  },
  peopleCopy: {
    flex: 1,
    marginLeft: 9,
  },
  peopleLabel: {
    color: 'rgba(245,238,224,0.66)',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 1.6,
    marginBottom: 2,
  },
  peopleText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  peopleTextCompact: {
    fontSize: 12,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingBottom: 2,
    justifyContent: 'space-between',
  },
  actionBarCompact: {
    gap: 10,
    marginTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 0,
  },
  detailsButton: {
    width: 110,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.34)',
    backgroundColor: 'rgba(20,18,15,0.98)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  detailsButtonCompact: {
    width: 110,
    height: 52,
    borderRadius: 16,
  },
  detailsButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
  detailsButtonTextCompact: {
    fontSize: 12,
  },
  joinButtonWrap: {
    width: 86,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 9 },
  },
  joinButton: {
    width: 86,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#F6B737',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
    shadowColor: colors.primary,
    shadowOpacity: 0.52,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  joinButtonCompact: {
    width: 86,
    height: 56,
  },
  joinedButton: {
    backgroundColor: colors.primary,
  },
  disabledButton: {
    opacity: 0.68,
  },
  joinLogo: {
    transform: [{ scale: 0.92 }],
  },
  bookmarkButtonWrap: {
    width: 110,
  },
  bookmarkButton: {
    width: 110,
    height: 52,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.34)',
    backgroundColor: 'rgba(20,18,15,0.98)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  bookmarkButtonCompact: {
    width: 110,
    height: 52,
    borderRadius: 16,
  },
  bookmarkButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  mapModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.74)',
    justifyContent: 'center',
    padding: 22,
  },
  mapModal: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    borderRadius: 24,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.42)',
    padding: 16,
    shadowColor: colors.primary,
    shadowOpacity: 0.22,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 18,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  mapModalTitleBlock: {
    flex: 1,
    paddingRight: 12,
  },
  mapModalEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2.6,
    marginBottom: 5,
  },
  mapModalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    lineHeight: 26,
  },
  mapCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.22)',
    backgroundColor: 'rgba(22,22,22,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPreview: {
    height: 220,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  mapPreviewImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  mapPreviewTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,14,4,0.08)',
  },
  mapGridHorizontal: {
    position: 'absolute',
    left: -20,
    right: -20,
    height: 1,
    backgroundColor: 'rgba(246,196,69,0.08)',
    transform: [{ rotate: '-18deg' }],
  },
  mapGridVertical: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 1,
    backgroundColor: 'rgba(246,196,69,0.08)',
    transform: [{ rotate: '24deg' }],
  },
  mapPin: {
    position: 'absolute',
    top: '42%',
    left: '50%',
    width: 58,
    height: 58,
    borderRadius: 29,
    marginLeft: -29,
    marginTop: -29,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.46,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  mapPreviewText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '900',
  },
  mapPreviewLabel: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 14,
    alignSelf: 'center',
    borderRadius: 999,
    backgroundColor: 'rgba(246,196,69,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  addressBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.18)',
    backgroundColor: 'rgba(20,20,20,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  addressText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 8,
  },
  openMapsButton: {
    height: 48,
    borderRadius: 999,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  openMapsText: {
    color: colors.primaryText,
    fontSize: 14,
    fontWeight: '900',
    marginLeft: 8,
  },
});
