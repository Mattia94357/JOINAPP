import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import SwipeDeck from '../components/SwipeDeck';
import ParticipantsModal from '../components/ParticipantsModal';
import { useAuth } from '../context/AuthContext';
import { ActivityResponse, fetchActivities, joinActivityRequest, saveActivityRequest, updateProfileRequest, updatePushTokenRequest } from '../api';
import { curatedActivities } from '../utils/curatedActivities';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { activityCategories } from '../utils/categories';
import { colors, spacing } from '../theme';

const categories = ['All', ...activityCategories];
const quickFilterChips = [
  { label: 'All', value: 'All' },
  { label: 'Food', value: 'Food' },
  { label: 'Drinks', value: 'Drinks' },
  { label: 'Sports', value: 'Sports' },
  { label: 'Outdoors', value: 'Outdoors' },
  { label: 'Wellness', value: 'Wellness' },
  { label: 'Networking', value: 'Networking' },
];
const hostGenderFilters = [
  { label: 'All hosts', value: 'all' },
  { label: 'Male hosts', value: 'male' },
  { label: 'Female hosts', value: 'female' },
  { label: 'Non-binary hosts', value: 'non_binary' },
] as const;
type HostGenderFilter = typeof hostGenderFilters[number]['value'];

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;
type BottomNavIconProps = {
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
};

function BottomNavIcon({ accessibilityLabel, icon, onPress }: BottomNavIconProps) {
  const pressProgress = useRef(new Animated.Value(0)).current;

  const animatePress = (toValue: number) => {
    Animated.timing(pressProgress, {
      toValue,
      duration: toValue ? 90 : 110,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      style={styles.bottomNavItem}
      onPress={onPress}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.bottomNavIcon,
            pressed && styles.bottomNavIconActive,
            {
              opacity: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
              transform: [{ scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }) }],
            },
          ]}
        >
          <Ionicons name={icon} size={25} color={pressed ? colors.primary : colors.textMuted} />
        </Animated.View>
      )}
    </Pressable>
  );
}

export default function HomeScreen({ navigation }: Props) {
  const { user, token, updateUser } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 520;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedHostGender, setSelectedHostGender] = useState<HostGenderFilter>('all');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [photoRequiredVisible, setPhotoRequiredVisible] = useState(false);
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState('');
  const [participantsActivity, setParticipantsActivity] = useState<ActivityResponse | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialDismissedForUserId, setTutorialDismissedForUserId] = useState<string | null>(null);

  const showTutorial = Boolean(user && !user.hasCompletedOnboardingTutorial && tutorialDismissedForUserId !== user.id);
  const tutorialScreens = [
    { icon: 'albums-outline', title: 'Browse activities', text: 'Browse real plans nearby.', highlight: 'Activity card' },
    { icon: 'play-skip-forward-outline', title: 'Pass', text: 'Swipe left to pass and keep browsing.', highlight: 'Swipe left' },
    { icon: 'checkmark-circle-outline', title: 'Join', text: 'Swipe right or tap Join Activity when something looks good.', highlight: 'Join Activity' },
    { icon: 'add-circle-outline', title: 'Host', text: 'Want to create your own plan? Tap Host.', highlight: 'Host' },
  ];

  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) => {
        return selectedCategory === 'All' || activity.category === selectedCategory;
      }),
    [activities, selectedCategory],
  );

  const curatedFeedForCategory = useMemo(
    () =>
      selectedCategory === 'All'
        ? curatedActivities
        : curatedActivities.filter((activity) => activity.category === selectedCategory),
    [selectedCategory],
  );

  const visibleFeed = useMemo(() => {
    const baseFeed = filteredActivities.length > 0 ? filteredActivities : [];
    const existingIds = new Set(baseFeed.map((activity) => activity.id));
    const supplements = curatedFeedForCategory.filter((activity) => !existingIds.has(activity.id));
    const combinedFeed = [...baseFeed, ...supplements];
    return combinedFeed.length > 0 ? combinedFeed : curatedActivities;
  }, [curatedFeedForCategory, filteredActivities]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setToastMessage('');

      try {
        const result = await fetchActivities(token || undefined, selectedHostGender === 'all' ? undefined : { hostGender: selectedHostGender });
        setActivities(markJoinedActivities(result));
      } catch (error) {
        setToastMessage('Showing curated plans.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, user?.id, user?.name, selectedHostGender]);

  useEffect(() => {
    if (!toastMessage) return undefined;

    const timeout = setTimeout(() => setToastMessage(''), 1800);
    return () => clearTimeout(timeout);
  }, [toastMessage]);

  const matchesCurrentUserId = (id?: string) => Boolean(user?.id && id && String(id) === String(user.id));

  const hasCurrentUserJoined = (activity: ActivityResponse) =>
    matchesCurrentUserId(activity.hostId) || activity.participants.some((participant) => matchesCurrentUserId(participant.id));

  const markJoinedActivities = (items: ActivityResponse[]) =>
    items.map((activity) => ({
      ...activity,
      // Membership is intentionally ID-only. A matching display name must never unlock chat.
      joined: hasCurrentUserJoined(activity),
      pending: activity.pending || Boolean(user && activity.pendingParticipants?.some((participant) => matchesCurrentUserId(participant.id))),
      declined: activity.declined || Boolean(user && activity.declinedParticipants?.some((participant) => matchesCurrentUserId(participant.id))),
      waitlisted: activity.waitlisted || Boolean(user && activity.waitlist?.some((participant) => matchesCurrentUserId(participant.id))),
      saved: user ? user.savedActivities?.some((id) => id === activity.id) : false,
    }));

  const refreshActivities = async () => {
    try {
      const result = await fetchActivities(token || undefined, selectedHostGender === 'all' ? undefined : { hostGender: selectedHostGender });
      setActivities(markJoinedActivities(result));
    } catch (error) {
      console.warn(error);
    }
  };

  const showProfilePhotoRequired = () => {
    setPhotoRequiredVisible(true);
  };

  const handleJoinActivity = async (activity: ActivityResponse) => {
    if (hasCurrentUserJoined(activity)) {
      navigation.navigate('Chat', { chatId: activity.id, title: activity.title });
      return true;
    }
    if (activity.pending || activity.declined || activity.waitlisted || activity.status === 'cancelled' || activity.status === 'completed') {
      return false;
    }

    if (!token) {
      Alert.alert('Sign in required', 'Please log in to join this activity.');
      return false;
    }

    const hasProfilePhoto = Boolean(user?.profilePictureUrl || user?.profileThumbnailUrl);
    if (!hasProfilePhoto) {
      showProfilePhotoRequired();
      return false;
    }

    try {
      const response = await joinActivityRequest(activity.id, token);
      const status = response.data?.status;
      if (status === 'pending') {
        Alert.alert('Request sent', 'The host will review your request.');
      } else if (status === 'declined') {
        Alert.alert('Request declined', 'The host declined this request.');
      } else if (status === 'waitlisted') {
        Alert.alert('Waitlist joined', 'This activity is full, so you joined the waitlist.');
      } else {
        Alert.alert('Joined', `You joined ${activity.title}.`);
        setActivities((currentActivities) => currentActivities.map((currentActivity) => {
          if (currentActivity.id !== activity.id || !user) return currentActivity;

          const alreadyListed = currentActivity.participants.some((participant) => matchesCurrentUserId(participant.id));
          const participants = alreadyListed
            ? currentActivity.participants
            : [
              ...currentActivity.participants,
              {
                id: user.id,
                name: user.name,
                avatar: user.profileThumbnailUrl || user.profilePictureUrl,
                profileThumbnailUrl: user.profileThumbnailUrl,
                profilePictureUrl: user.profilePictureUrl,
              },
            ];

          return {
            ...currentActivity,
            participants,
            attendees: alreadyListed ? (currentActivity.attendees ?? currentActivity.participants.length) : (currentActivity.attendees ?? currentActivity.participants.length) + 1,
            joined: true,
            pending: false,
            declined: false,
            waitlisted: false,
          };
        }));
      }
      if (!user?.pushToken) {
        try {
          const pushToken = await registerForPushNotificationsAsync();
          if (pushToken) {
            const response = await updatePushTokenRequest(pushToken, token);
            await updateUser(response.data);
          }
        } catch (error) {
          console.warn('Unable to register push notifications after join', error);
        }
      }
      // Keep the card in place so the CTA immediately transitions from JOIN to CHAT.
      void refreshActivities();
      return false;
    } catch (error: any) {
      console.warn(error);
      if (error?.response?.data?.code === 'PROFILE_PHOTO_REQUIRED') {
        showProfilePhotoRequired();
        return false;
      }
      Alert.alert('Unable to join', error?.response?.data?.message || 'There was an issue joining this activity.');
      return false;
    }
  };

  const handleSaveActivity = async (activity: ActivityResponse) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to save activities.');
      return;
    }

    try {
      const response = await saveActivityRequest(activity.id, token);
      if (user && response.data?.savedActivities) {
        await updateUser({
          ...user,
          savedActivities: response.data.savedActivities.map((id: any) => String(id)),
        });
      }
      setActivities((prev) => prev.map((item) => item.id === activity.id ? { ...item, saved: !item.saved } : item));
    } catch (error: any) {
      Alert.alert('Unable to save', error?.response?.data?.message || 'Please try again.');
    }
  };

  const completeTutorial = async () => {
    setTutorialDismissedForUserId(user?.id || 'current-session');
    setTutorialStep(0);

    if (user) {
      await updateUser({ ...user, hasCompletedOnboardingTutorial: true });
    }

    if (!token) return;
    try {
      const response = await updateProfileRequest({ hasCompletedOnboardingTutorial: true }, token);
      await updateUser(response.data);
    } catch (error) {
      console.warn('Unable to finish onboarding tutorial', error);
      setToastMessage('Tutorial dismissed.');
    }
  };

  const skipTutorial = () => {
    completeTutorial();
  };

  const handlePress = (activity: ActivityResponse) => {
    navigation.navigate('Activity', { activityId: activity.id });
  };

  const openPublicProfile = (participant: { id?: string; name: string; avatar?: string }) => {
    navigation.navigate('PublicProfile', {
      userId: participant.id || participant.name,
      fallbackName: participant.name,
      fallbackAvatar: participant.avatar,
    });
  };

  const openLatestChat = () => {
    const chatActivity = activities.find((activity) => activity.joined) || activities.find((activity) => matchesCurrentUserId(activity.hostId));
    if (chatActivity) {
      navigation.navigate('Chat', { chatId: chatActivity.id, title: chatActivity.title });
      return;
    }
    Alert.alert('No active chats yet', 'Join an activity first to unlock its chat.');
  };

  const hasNoCategoryResults = !loading && selectedCategory !== 'All' && visibleFeed.length === 0;

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && styles.containerWeb, compact && styles.containerCompact]}>
      <View style={[styles.topBar, compact && styles.topBarCompact]}>
        <TouchableOpacity style={[styles.filterButton, compact && styles.filterButtonCompact]} onPress={() => setCategoryModalVisible(true)} activeOpacity={0.82}>
            <Ionicons name="options-outline" size={compact ? 20 : 24} color={colors.primary} />
          <Text style={[styles.filterButtonText, compact && styles.filterButtonTextCompact]}>Filter</Text>
        </TouchableOpacity>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
          contentContainerStyle={styles.filterChipRow}
        >
          {quickFilterChips.map((chip) => {
            const active = selectedCategory === chip.value;
            return (
              <TouchableOpacity
                key={`${chip.label}-${chip.value}`}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => setSelectedCategory(chip.value)}
                activeOpacity={0.82}
              >
                <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{chip.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.deckContainer}>
        {loading ? (
          <View style={styles.skeletonCard}>
            <View style={styles.skeletonImage} />
            <View style={styles.skeletonLineLarge} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonAvatars}>
              {[0, 1, 2].map((item) => <View key={item} style={styles.skeletonAvatar} />)}
            </View>
            <ActivityIndicator color={colors.primary} size="small" />
          </View>
        ) : (
          <SwipeDeck
            key={`${selectedCategory}-${visibleFeed.length}`}
            activities={visibleFeed}
            onSwipeLeft={() => {
              return true;
            }}
            onSwipeRight={handleJoinActivity}
            onSave={handleSaveActivity}
            onPress={handlePress}
            onViewParticipants={setParticipantsActivity}
            onOpenProfile={openPublicProfile}
          />
        )}
      </View>

      {hasNoCategoryResults ? <Text style={styles.statusText}>No {selectedCategory} activities yet. Try another category or host the first one.</Text> : null}
      {toastMessage ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      <View style={styles.bottomNav}>
        <View style={styles.bottomNavDivider} pointerEvents="none" />
        <BottomNavIcon accessibilityLabel="Host" icon="add-circle-outline" onPress={() => navigation.navigate('CreateActivity')} />
        <BottomNavIcon accessibilityLabel="Notifications" icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} />
        <BottomNavIcon accessibilityLabel="Messages" icon="chatbubbles-outline" onPress={openLatestChat} />
        <BottomNavIcon accessibilityLabel="Profile" icon="person-circle-outline" onPress={() => navigation.navigate('Profile')} />
      </View>

      <ParticipantsModal
        visible={Boolean(participantsActivity)}
        participants={participantsActivity?.participants || []}
        onClose={() => setParticipantsActivity(null)}
        onOpenProfile={(participant) => {
          setParticipantsActivity(null);
          openPublicProfile(participant);
        }}
      />

      <Modal
        visible={photoRequiredVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoRequiredVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoRequiredModal}>
            <View style={styles.photoRequiredIcon}>
              <Ionicons name="camera-outline" size={24} color={colors.primaryText} />
            </View>
            <Text style={styles.modalTitle}>Profile photo required</Text>
            <Text style={styles.photoRequiredText}>
              Profile photos are required before joining activities so everyone can see who is attending.
            </Text>
            <TouchableOpacity
              style={styles.photoRequiredPrimary}
              onPress={() => {
                setPhotoRequiredVisible(false);
                navigation.navigate('Profile');
              }}
            >
              <Text style={styles.photoRequiredPrimaryText}>Upload profile photo</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.photoRequiredSecondary}
              onPress={() => setPhotoRequiredVisible(false)}
            >
              <Text style={styles.photoRequiredSecondaryText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(showTutorial)}
        transparent
        animationType="fade"
        onRequestClose={completeTutorial}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tutorialModal}>
            <View style={styles.tutorialHero}>
              <View style={styles.tutorialIcon}>
                <Ionicons name={tutorialScreens[tutorialStep].icon as any} size={24} color={colors.primaryText} />
              </View>
              <View style={styles.tutorialPreviewCard}>
                <Text style={styles.tutorialPreviewEyebrow}>{tutorialScreens[tutorialStep].highlight}</Text>
                <Text style={styles.tutorialPreviewTitle}>
                  {tutorialStep === 0 ? 'Rooftop dinner' : tutorialStep === 1 ? 'Keep browsing' : tutorialStep === 2 ? 'Join Activity' : 'Create a plan'}
                </Text>
                <Text style={styles.tutorialPreviewMeta}>
                  {tutorialStep === 0 ? 'Real plans nearby' : tutorialStep === 1 ? 'Swipe left or tap Skip' : tutorialStep === 2 ? 'Swipe right or tap Join' : 'Tap Host anytime'}
                </Text>
              </View>
            </View>
            <Text style={styles.modalTitle}>{tutorialScreens[tutorialStep].title}</Text>
            <Text style={styles.photoRequiredText}>{tutorialScreens[tutorialStep].text}</Text>
            <View style={styles.tutorialDots}>
              {tutorialScreens.map((_, index) => <View key={index} style={[styles.tutorialDot, index === tutorialStep && styles.tutorialDotActive]} />)}
            </View>
            <TouchableOpacity
              style={styles.photoRequiredPrimary}
              onPress={() => {
                if (tutorialStep >= tutorialScreens.length - 1) {
                  completeTutorial();
                } else {
                  setTutorialStep((step) => step + 1);
                }
              }}
            >
              <Text style={styles.photoRequiredPrimaryText}>{tutorialStep >= tutorialScreens.length - 1 ? 'Start exploring' : 'Next'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoRequiredSecondary} onPress={skipTutorial}>
              <Text style={styles.photoRequiredSecondaryText}>Skip tutorial</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.categoryModal}>
            <Text style={styles.modalTitle}>Curated near you</Text>
            <Text style={styles.modalIntro}>Filter discovery by activity or visible host details. Host gender is optional and only shown when hosts choose to make it public.</Text>

            <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterGroupTitle}>Activity</Text>
              {categories.map((category) => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.modalCategoryItem,
                    selectedCategory === category && styles.modalCategoryItemActive,
                  ]}
                  onPress={() => {
                    setSelectedCategory(category);
                    setCategoryModalVisible(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalCategoryText,
                      selectedCategory === category && styles.modalCategoryTextActive,
                    ]}
                  >
                    {category}
                  </Text>
                </TouchableOpacity>
              ))}
              <Text style={styles.filterGroupTitle}>Host gender</Text>
              {hostGenderFilters.map((filter) => (
                <TouchableOpacity
                  key={filter.value}
                  style={[
                    styles.modalCategoryItem,
                    selectedHostGender === filter.value && styles.modalCategoryItemActive,
                  ]}
                  onPress={() => setSelectedHostGender(filter.value)}
                >
                  <Text
                    style={[
                      styles.modalCategoryText,
                      selectedHostGender === filter.value && styles.modalCategoryTextActive,
                    ]}
                  >
                    {filter.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setCategoryModalVisible(false)}
            >
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    backgroundColor: '#0B0B0B',
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  containerWeb: {
    height: '100dvh' as any,
    maxHeight: '100dvh' as any,
    paddingTop: 'calc(8px + env(safe-area-inset-top))' as any,
  },
  containerCompact: {
    paddingHorizontal: 18,
    paddingTop: 6,
  },
  topBar: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    marginBottom: 20,
    gap: 8,
  },
  topBarCompact: {
    gap: 8,
    marginBottom: 18,
  },
  filterButton: {
    height: 42,
    borderRadius: 999,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(18,16,12,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.34)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  filterButtonCompact: {
    height: 39,
    paddingHorizontal: 12,
  },
  filterButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 7,
  },
  filterButtonTextCompact: {
    fontSize: 12,
  },
  filterScroller: {
    flex: 1,
  },
  filterChipRow: {
    alignItems: 'center',
    paddingRight: 2,
    gap: 7,
  },
  filterChip: {
    height: 38,
    borderRadius: 999,
    paddingHorizontal: 15,
    backgroundColor: 'rgba(16,16,16,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.28,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  filterChipText: {
    color: 'rgba(245,238,224,0.76)',
    fontSize: 12,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: colors.primaryText,
  },
  deckContainer: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    marginTop: 0,
    paddingBottom: Platform.OS === 'web'
      ? ('calc(72px + env(safe-area-inset-bottom))' as any)
      : 72,
  },
  skeletonCard: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  skeletonImage: {
    flex: 1,
    minHeight: 0,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    marginBottom: spacing.md,
  },
  skeletonLineLarge: {
    width: '76%',
    height: 18,
    borderRadius: 999,
    backgroundColor: colors.borderStrong,
    marginBottom: spacing.sm,
  },
  skeletonLine: {
    width: '52%',
    height: 12,
    borderRadius: 999,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  skeletonAvatars: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  skeletonAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.borderStrong,
    marginRight: -6,
    borderWidth: 1,
    borderColor: colors.surface,
  },
  statusText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  toast: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    bottom: 104,
    alignSelf: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(14,14,14,0.92)',
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  toastText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  bottomNav: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    height: Platform.OS === 'web'
      ? ('calc(54px + env(safe-area-inset-bottom))' as any)
      : 54,
    maxWidth: 520,
    alignSelf: 'center',
    marginHorizontal: 'auto' as any,
    paddingTop: 2,
    paddingBottom: Platform.OS === 'web'
      ? ('calc(2px + env(safe-area-inset-bottom))' as any)
      : 2,
    paddingHorizontal: 10,
    backgroundColor: Platform.OS === 'web' ? 'rgba(8,8,8,0.88)' : 'rgba(8,8,8,0.96)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.48), 0 0 14px rgba(245,190,60,0.12)',
    } as any) : {}),
  },
  bottomNavDivider: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(246,196,69,0.16)',
  },
  bottomNavItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    marginHorizontal: 2,
    paddingHorizontal: 2,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavIconActive: {
    backgroundColor: 'rgba(8,8,8,0.76)',
    borderColor: colors.goldBorder,
    shadowColor: colors.primary,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  categoryModal: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoRequiredModal: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.32,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  tutorialModal: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    shadowColor: colors.shadow,
    shadowOpacity: 0.36,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  tutorialHero: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  tutorialIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tutorialPreviewCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 12,
    padding: spacing.md,
  },
  tutorialPreviewEyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  tutorialPreviewTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    marginTop: 5,
  },
  tutorialPreviewMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
    marginTop: 4,
  },
  tutorialDots: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  tutorialDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.borderStrong,
    marginRight: 6,
  },
  tutorialDotActive: {
    backgroundColor: colors.primary,
  },
  photoRequiredIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  photoRequiredText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: spacing.lg,
  },
  photoRequiredPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoRequiredPrimaryText: {
    color: colors.primaryText,
    fontWeight: '900',
  },
  photoRequiredSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoRequiredSecondaryText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  modalTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: spacing.md,
  },
  modalIntro: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    marginBottom: spacing.md,
  },
  filterGroupTitle: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  modalCategoryItem: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  categoryList: {
    maxHeight: 420,
  },
  modalCategoryItemActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  modalCategoryText: {
    color: colors.text,
    fontWeight: '800',
  },
  modalCategoryTextActive: {
    color: colors.primaryText,
  },
  modalCloseButton: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modalCloseText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
});
