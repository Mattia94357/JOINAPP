import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutChangeEvent, Pressable, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarBadge from './AvatarBadge';
import { getActivityCoverImage } from '../utils/activityAssets';
import { colors } from '../theme';
import LocationPreviewModal from './LocationPreviewModal';

export type Activity = {
  id: string;
  title: string;
  category: string;
  location: string;
  locationName?: string;
  exactAddress?: string;
  latitude?: number;
  longitude?: number;
  isApproximateLocation?: boolean;
  locationPrivacy?: 'public' | 'approximate' | 'private';
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
  onPass?: () => void;
  onJoin?: () => void;
  actionsDisabled?: boolean;
  onSave?: () => void;
  onViewParticipants?: (activity: Activity) => void;
  onOpenProfile?: (participant: { id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }) => void;
};

export default function ActivityCard({
  activity,
  onPress,
  onPass,
  onJoin,
  actionsDisabled,
  onSave,
  onViewParticipants,
  onOpenProfile,
}: Props) {
  const { width } = useWindowDimensions();
  const fallbackCoverImage = getActivityCoverImage(activity.category, activity.id);
  const [coverImage, setCoverImage] = useState(activity.coverImage || fallbackCoverImage);
  const [cardHeight, setCardHeight] = useState(0);
  const [locationPreviewVisible, setLocationPreviewVisible] = useState(false);
  const attendees = activity.attendees ?? activity.participants.length;
  const spotsLeft = activity.maxAttendees ? Math.max(activity.maxAttendees - attendees, 0) : null;
  const visibleParticipants = activity.participants.slice(0, 3);
  const hiddenParticipantCount = Math.max(0, attendees - visibleParticipants.length);
  const previewPeople = visibleParticipants.length
    ? visibleParticipants
    : [{ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar }];
  const imagePressScale = useRef(new Animated.Value(1)).current;
  const imagePressOpacity = useRef(new Animated.Value(1)).current;
  const bookmarkScale = useRef(new Animated.Value(1)).current;
  const entrance = useRef(new Animated.Value(0)).current;
  const passScale = useRef(new Animated.Value(1)).current;
  const joinScale = useRef(new Animated.Value(1)).current;
  const compact = width < 520;
  const dense = cardHeight > 0 && cardHeight < 540;
  const veryDense = cardHeight > 0 && cardHeight < 440;

  useEffect(() => {
    Animated.timing(entrance, { toValue: 1, duration: 360, useNativeDriver: true }).start();
  }, [entrance]);

  const handleCardLayout = (event: LayoutChangeEvent) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    if (nextHeight !== cardHeight) setCardHeight(nextHeight);
  };

  const animateImagePress = (pressed: boolean) => {
    Animated.parallel([
      Animated.timing(imagePressScale, {
        toValue: pressed ? 0.99 : 1,
        duration: pressed ? 90 : 130,
        useNativeDriver: true,
      }),
      Animated.timing(imagePressOpacity, {
        toValue: pressed ? 0.96 : 1,
        duration: pressed ? 90 : 130,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const animateDecisionPress = (scale: Animated.Value, pressed: boolean) => {
    Animated.spring(scale, {
      toValue: pressed ? 0.92 : 1,
      speed: 28,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View
      style={[styles.fill, {
          opacity: entrance,
          transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        }]}
    >
      <View style={styles.cardStage}>
        <View style={[styles.card, styles.imageFrame]} onLayout={handleCardLayout}>
            <Animated.Image
              source={{ uri: coverImage }}
              style={[styles.image, { opacity: imagePressOpacity, transform: [{ scale: imagePressScale }] }]}
              onError={() => setCoverImage(fallbackCoverImage)}
            />
            <View style={styles.imageWarmth} />
            <View style={styles.bottomScrim} />

            <Pressable
              style={styles.imagePressTarget}
              onPress={onPress}
              onPressIn={() => animateImagePress(true)}
              onPressOut={() => animateImagePress(false)}
              accessibilityRole="button"
              accessibilityLabel="Open activity details"
            />

            <View style={styles.cardHeader} pointerEvents="box-none">
              <View style={styles.categoryBadge} pointerEvents="none">
                <Text style={[styles.categoryText, compact && styles.categoryTextCompact]} numberOfLines={1}>{activity.category}</Text>
              </View>

              <Animated.View style={[styles.headerActions, { transform: [{ scale: bookmarkScale }] }]}>
                  <TouchableOpacity
                    style={[styles.headerActionButton, activity.saved && styles.headerActionButtonActive]}
                    onPress={() => {
                      Animated.sequence([
                        Animated.timing(bookmarkScale, { toValue: 0.82, duration: 90, useNativeDriver: true }),
                        Animated.spring(bookmarkScale, { toValue: 1, useNativeDriver: true, friction: 3 }),
                      ]).start();
                      onSave?.();
                    }}
                    activeOpacity={0.78}
                    accessibilityRole="button"
                    accessibilityLabel={activity.saved ? 'Remove bookmark' : 'Bookmark activity'}
                  >
                    <Ionicons name={activity.saved ? 'bookmark' : 'bookmark-outline'} size={compact ? 23 : 25} color={activity.saved ? colors.primaryText : colors.primary} />
                  </TouchableOpacity>
              </Animated.View>
            </View>

            <TouchableOpacity
              style={styles.detailsNavigationButton}
              onPress={onPress}
              activeOpacity={0.76}
              accessibilityRole="button"
              accessibilityLabel="Open activity details"
            >
              <Ionicons name="chevron-up" size={22} color={colors.primary} />
            </TouchableOpacity>

            <View style={[styles.imageCopy, compact && styles.imageCopyCompact, dense && styles.imageCopyDense, veryDense && styles.imageCopyVeryDense]}>
              <Text style={[styles.title, compact && styles.titleCompact, dense && styles.titleDense]} numberOfLines={1}>{activity.title}</Text>

              <TouchableOpacity
                style={[styles.hostRow, dense && styles.hostRowDense]}
                activeOpacity={0.85}
                onPress={() => onOpenProfile?.({ id: activity.hostId, name: activity.host, avatar: activity.hostAvatar })}
              >
              <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={72} />
                <View style={styles.hostCopy}>
                  <Text style={styles.hostLabel}>HOSTED BY</Text>
                <Text style={[styles.hostText, compact && styles.hostTextCompact]} numberOfLines={1}>{activity.host}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.metaLine, dense && styles.metaLineDense]}
                onPress={() => setLocationPreviewVisible(true)}
                activeOpacity={0.78}
                accessibilityRole="button"
                accessibilityLabel={`Preview map for ${activity.locationName || activity.location}`}
              >
                <View style={styles.locationPressable}>
                  <Ionicons name="location-outline" size={compact ? 17 : 20} color={colors.primary} />
                  <Text
                    style={[styles.metaText, compact && styles.metaTextCompact]}
                    numberOfLines={1}
                  >
                    {activity.locationName || activity.location}
                  </Text>
                </View>
                <Text style={styles.metaDot}>•</Text>
                <View style={styles.timeMeta}>
                  <Ionicons name="time-outline" size={compact ? 17 : 20} color={colors.primary} />
                  <Text style={[styles.metaText, compact && styles.metaTextCompact]} numberOfLines={1}>{activity.time || 'Anytime'}</Text>
                </View>
              </TouchableOpacity>

              <View style={[styles.divider, dense && styles.dividerDense]} />

              <View style={[styles.aboutRow, dense && styles.aboutRowDense]}>
                <Text style={styles.aboutLabel}>ABOUT THIS ACTIVITY</Text>
                <Text style={[styles.aboutText, compact && styles.aboutTextCompact]} numberOfLines={1} ellipsizeMode="tail">
                  {activity.description}
                </Text>
              </View>

              <TouchableOpacity style={[styles.peopleRow, dense && styles.peopleRowDense]} onPress={() => onViewParticipants?.(activity)} activeOpacity={0.86}>
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

          <View style={styles.decisionControls} pointerEvents="box-none">
            <Animated.View style={[styles.passDecisionControl, { transform: [{ scale: passScale }] }]}>
              <TouchableOpacity
                style={styles.decisionTouchTarget}
                onPress={onPass}
                onPressIn={() => animateDecisionPress(passScale, true)}
                onPressOut={() => animateDecisionPress(passScale, false)}
                disabled={!onPass || actionsDisabled}
                activeOpacity={0.76}
                accessibilityRole="button"
                accessibilityLabel="Pass on activity"
              >
                <View style={styles.decisionButton}>
                  <Ionicons name="close" size={30} color={colors.primary} />
                </View>
              </TouchableOpacity>
            </Animated.View>

            <Animated.View style={[styles.joinDecisionControl, { transform: [{ scale: joinScale }] }]}>
              <TouchableOpacity
                style={styles.decisionTouchTarget}
                onPress={onJoin}
                onPressIn={() => animateDecisionPress(joinScale, true)}
                onPressOut={() => animateDecisionPress(joinScale, false)}
                disabled={!onJoin || actionsDisabled}
                activeOpacity={0.76}
                accessibilityRole="button"
                accessibilityLabel="Join activity"
              >
                <View style={styles.decisionButton}>
                  <Ionicons name="checkmark" size={31} color={colors.primary} />
                </View>
              </TouchableOpacity>
            </Animated.View>
          </View>
      </View>

      <LocationPreviewModal
        visible={locationPreviewVisible}
        activity={activity}
        onClose={() => setLocationPreviewVisible(false)}
      />

    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    minHeight: 0,
    width: '100%',
  },
  cardStage: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    paddingBottom: 38,
  },
  card: {
    flex: 1,
    minHeight: 0,
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
  imagePressTarget: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: '52%',
    zIndex: 1,
  },
  cardHeader: {
    position: 'absolute',
    top: 14,
    left: 14,
    right: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 2,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: 'rgba(26,22,16,0.78)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.16)',
  },
  headerActions: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.28)',
    backgroundColor: 'rgba(20,18,15,0.9)',
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
  },
  headerActionButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerActionButtonActive: {
    backgroundColor: colors.primary,
  },
  categoryText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  categoryTextCompact: {
    fontSize: 12,
  },
  imageCopy: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 24,
  },
  imageCopyCompact: {
    left: 20,
    right: 20,
    bottom: 22,
  },
  imageCopyDense: {
    left: 14,
    right: 14,
    bottom: 12,
  },
  imageCopyVeryDense: {
    bottom: 8,
  },
  decisionControls: {
    position: 'absolute',
    bottom: -18,
    left: 0,
    right: 0,
    height: 56,
    zIndex: 5,
  },
  passDecisionControl: {
    position: 'absolute',
    left: '20%',
    marginLeft: -28,
  },
  joinDecisionControl: {
    position: 'absolute',
    right: '20%',
    marginRight: -28,
  },
  decisionTouchTarget: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.48)',
    backgroundColor: 'rgba(15,14,12,0.94)',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  detailsNavigationButton: {
    position: 'absolute',
    top: '48%',
    left: '50%',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.48)',
    backgroundColor: 'rgba(15,14,12,0.96)',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
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
  titleDense: {
    fontSize: 21,
    lineHeight: 24,
    marginBottom: 6,
  },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 34,
    marginBottom: 11,
  },
  hostRowDense: {
    marginBottom: 5,
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
  metaLineDense: {
    marginBottom: 4,
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
  dividerDense: {
    marginBottom: 6,
  },
  aboutRow: {
    marginBottom: 16,
  },
  aboutRowDense: {
    marginBottom: 6,
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
    minHeight: 42,
  },
  peopleRowDense: {
    minHeight: 34,
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
});
