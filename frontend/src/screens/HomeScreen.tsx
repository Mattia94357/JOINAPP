import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  useWindowDimensions,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { CommonActions } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import SwipeDeck from '../components/SwipeDeck';
import ParticipantsModal from '../components/ParticipantsModal';
import BottomNavigation, {
  BOTTOM_NAV_HEIGHT,
} from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { ActivityResponse, fetchActivities, joinActivityRequest, saveActivityRequest, updateProfileRequest, updatePushTokenRequest } from '../api';
import { curatedActivities } from '../utils/curatedActivities';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { activityCategories } from '../utils/categories';
import { colors, spacing } from '../theme';
import {
  activeExploreFilterCount,
  ActivityAgeGroup,
  activityDistanceKm,
  ageGroupOptions,
  Coordinate,
  dateOptions,
  DEFAULT_EXPLORE_FILTERS,
  distanceOptions,
  ExploreDateFilter,
  ExploreFilters,
  ExploreSort,
  ExploreTimeFilter,
  filterAndSortActivities,
  formatDistance,
  parseLocalDateInput,
  sortOptions,
  timeOptions,
} from '../utils/activityFilters';

const categories = ['All', ...activityCategories];
const quickFilterChips = categories.slice(0, 8).map((category) => ({ label: category, value: category }));

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation, route }: Props) {
  const { user, token, updateUser } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const isMapDecision = route.params?.source === 'map'
    && Boolean(route.params.mapDecisionActivity)
    && Boolean(route.params.mapReturnRouteKey);

  const [appliedFilters, setAppliedFilters] = useState<ExploreFilters>(DEFAULT_EXPLORE_FILTERS);
  const [draftFilters, setDraftFilters] = useState<ExploreFilters>(DEFAULT_EXPLORE_FILTERS);
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [userCoordinate, setUserCoordinate] = useState<Coordinate | null>(null);
  const [locationState, setLocationState] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle');
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

  const discoveryActivities = useMemo(() => {
    const existingIds = new Set(activities.map((activity) => activity.id));
    return [...activities, ...curatedActivities.filter((activity) => !existingIds.has(activity.id))];
  }, [activities]);

  const visibleFeed = useMemo(() => filterAndSortActivities(
    discoveryActivities,
    appliedFilters,
    userCoordinate,
  ).map((activity) => ({
    ...activity,
    distance: formatDistance(activityDistanceKm(activity, userCoordinate)),
  })), [appliedFilters, discoveryActivities, userCoordinate]);

  const activeFilterCount = activeExploreFilterCount(appliedFilters);

  const decisionFeed = useMemo(() => {
    const focusedActivity = route.params?.mapDecisionActivity;
    if (!isMapDecision || !focusedActivity) return visibleFeed;
    return [focusedActivity, ...visibleFeed.filter((activity) => activity.id !== focusedActivity.id)];
  }, [isMapDecision, route.params?.mapDecisionActivity, visibleFeed]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setToastMessage('');

      try {
        const result = await fetchActivities(token || undefined);
        setActivities(markJoinedActivities(result));
      } catch (error) {
        setToastMessage('Showing curated plans.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, user?.id, user?.name]);

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
      const result = await fetchActivities(token || undefined);
      setActivities(markJoinedActivities(result));
    } catch (error) {
      console.warn(error);
    }
  };

  const showProfilePhotoRequired = () => {
    setPhotoRequiredVisible(true);
  };

  const returnDecisionToMap = (
    decision: 'skip' | 'join',
    activityId: string,
    joinStatus?: 'joined' | 'pending' | 'declined' | 'waitlisted',
  ) => {
    const mapRouteKey = route.params?.mapReturnRouteKey;
    if (!isMapDecision || !mapRouteKey) return;

    navigation.dispatch({
      ...CommonActions.setParams({
        decisionResult: {
          activityId,
          decision,
          joinStatus,
          completedAt: Date.now(),
        },
      }),
      source: mapRouteKey,
    });
    navigation.goBack();
  };

  const handleJoinActivity = async (
    activity: ActivityResponse,
    onCompleted?: (status: 'joined' | 'pending' | 'declined' | 'waitlisted') => void,
  ) => {
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
      onCompleted?.(
        status === 'pending' || status === 'declined' || status === 'waitlisted'
          ? status
          : 'joined',
      );
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

  const ensureUserLocation = useCallback(async () => {
    if (userCoordinate) return userCoordinate;
    setLocationState('loading');
    try {
      const existingPermission = await Location.getForegroundPermissionsAsync();
      const permission = existingPermission.granted || !existingPermission.canAskAgain
        ? existingPermission
        : await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setLocationState('unavailable');
        return null;
      }
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Location timed out')), 6000)),
      ]);
      const coordinate = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserCoordinate(coordinate);
      setLocationState('ready');
      return coordinate;
    } catch {
      setLocationState('unavailable');
      return null;
    }
  }, [userCoordinate]);

  const openFilters = () => {
    setDraftFilters(appliedFilters);
    setFilterError('');
    setCategoryModalVisible(true);
  };

  const applyFilters = async () => {
    if (draftFilters.customDateEnabled) {
      const start = parseLocalDateInput(draftFilters.customStart);
      const end = parseLocalDateInput(draftFilters.customEnd || draftFilters.customStart, true);
      if (!start || !end || end < start) {
        setFilterError('Enter a valid custom date or range in YYYY-MM-DD format.');
        return;
      }
    }

    let nextFilters = draftFilters;
    if (draftFilters.sortBy === 'nearest' || draftFilters.distanceKm !== null) {
      const coordinate = await ensureUserLocation();
      if (!coordinate) {
        nextFilters = {
          ...draftFilters,
          sortBy: draftFilters.sortBy === 'nearest' ? 'soonest' : draftFilters.sortBy,
          distanceKm: null,
        };
        setToastMessage('Location unavailable. Using Soonest without a distance limit.');
      }
    }
    setAppliedFilters(nextFilters);
    setDraftFilters(nextFilters);
    setFilterError('');
    setCategoryModalVisible(false);
  };

  const resetFilters = () => {
    setAppliedFilters(DEFAULT_EXPLORE_FILTERS);
    setDraftFilters(DEFAULT_EXPLORE_FILTERS);
    setFilterError('');
  };

  const selectQuickCategory = (category: string) => {
    setAppliedFilters((current) => ({ ...current, category }));
    setDraftFilters((current) => ({ ...current, category }));
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

  const hasNoFilterResults = !loading && visibleFeed.length === 0;

  return (
    <SafeAreaView style={[styles.container, Platform.OS === 'web' && styles.containerWeb, compact && styles.containerCompact]}>
      <View
        pointerEvents="none"
        style={[styles.filterBackdrop, compact && styles.filterBackdropCompact]}
      >
        <View style={styles.filterBackdropFade} />
      </View>
      <View style={[styles.topBar, compact && styles.topBarCompact]}>
        <TouchableOpacity style={[styles.filterButton, activeFilterCount > 0 && styles.filterButtonActive, compact && styles.filterButtonCompact]} onPress={openFilters} activeOpacity={0.82}>
            <Ionicons name="options-outline" size={compact ? 20 : 24} color={colors.primary} />
          <Text style={[styles.filterButtonText, compact && styles.filterButtonTextCompact]}>Filter</Text>
          {activeFilterCount > 0 ? <View style={styles.filterCount}><Text style={styles.filterCountText}>{activeFilterCount}</Text></View> : null}
        </TouchableOpacity>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroller}
          contentContainerStyle={styles.filterChipRow}
        >
          {quickFilterChips.map((chip) => {
            const active = appliedFilters.category === chip.value;
            return (
              <TouchableOpacity
                key={`${chip.label}-${chip.value}`}
                style={[styles.filterChip, active && styles.filterChipActive]}
                onPress={() => selectQuickCategory(chip.value)}
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
        ) : hasNoFilterResults ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={28} color={colors.primary} />
            <Text style={styles.emptyStateTitle}>No activities match these filters</Text>
            <Text style={styles.emptyStateText}>Try widening your search.</Text>
            <TouchableOpacity style={styles.emptyResetButton} onPress={resetFilters}>
              <Text style={styles.emptyResetText}>Reset filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <SwipeDeck
            key={`${JSON.stringify(appliedFilters)}-${visibleFeed.length}`}
            activities={decisionFeed}
            onSwipeLeft={(activity) => {
              if (isMapDecision) {
                returnDecisionToMap('skip', activity.id);
                return false;
              }
              return true;
            }}
            onSwipeRight={(activity) => handleJoinActivity(
              activity,
              isMapDecision
                ? (status) => returnDecisionToMap('join', activity.id, status)
                : undefined,
            )}
            onSave={handleSaveActivity}
            onNotifications={() => navigation.navigate('Notifications')}
            onPress={handlePress}
            onViewParticipants={setParticipantsActivity}
            onOpenProfile={openPublicProfile}
          />
        )}
      </View>

      {toastMessage ? (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      <BottomNavigation mapActivities={visibleFeed} />

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
            <View style={styles.filterModalHeader}>
              <View style={styles.filterModalHeading}>
                <Text style={styles.modalTitle}>Explore activities</Text>
                <Text style={styles.modalIntro}>Find plans that fit what you want to do and when.</Text>
              </View>
              <TouchableOpacity onPress={() => setCategoryModalVisible(false)} accessibilityRole="button" accessibilityLabel="Close filters">
                <Ionicons name="close" size={24} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.categoryList} showsVerticalScrollIndicator={false}>
              <Text style={styles.filterGroupTitle}>Sort by</Text>
              <View style={styles.filterOptionRow}>
                {sortOptions.map((option) => {
                  const active = draftFilters.sortBy === option.value;
                  return <TouchableOpacity key={option.value} style={[styles.filterOption, active && styles.filterOptionActive]} onPress={() => setDraftFilters((current) => ({ ...current, sortBy: option.value as ExploreSort }))}>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{option.label}</Text>
                  </TouchableOpacity>;
                })}
              </View>

              <Text style={styles.filterGroupTitle}>When</Text>
              <View style={styles.filterOptionRow}>
                {dateOptions.map((option) => {
                  const active = !draftFilters.customDateEnabled && draftFilters.when === option.value;
                  return <TouchableOpacity key={option.value} style={[styles.filterOption, active && styles.filterOptionActive]} onPress={() => setDraftFilters((current) => ({ ...current, when: option.value as ExploreDateFilter, customDateEnabled: false }))}>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{option.label}</Text>
                  </TouchableOpacity>;
                })}
                <TouchableOpacity style={[styles.filterOption, draftFilters.customDateEnabled && styles.filterOptionActive]} onPress={() => setDraftFilters((current) => ({ ...current, customDateEnabled: true, when: 'any' }))}>
                  <Text style={[styles.filterOptionText, draftFilters.customDateEnabled && styles.filterOptionTextActive]}>Custom</Text>
                </TouchableOpacity>
              </View>
              {draftFilters.customDateEnabled ? (
                <View style={styles.customDateRow}>
                  <TextInput
                    style={[styles.dateInput, styles.customDateInput]}
                    value={draftFilters.customStart}
                    onChangeText={(customStart) => setDraftFilters((current) => ({ ...current, customStart }))}
                    placeholder="Start YYYY-MM-DD"
                    placeholderTextColor={colors.textSubtle}
                    {...(Platform.OS === 'web' ? ({ type: 'date' } as any) : {})}
                  />
                  <TextInput
                    style={[styles.dateInput, styles.customDateInput]}
                    value={draftFilters.customEnd}
                    onChangeText={(customEnd) => setDraftFilters((current) => ({ ...current, customEnd }))}
                    placeholder="End (optional)"
                    placeholderTextColor={colors.textSubtle}
                    {...(Platform.OS === 'web' ? ({ type: 'date' } as any) : {})}
                  />
                </View>
              ) : null}

              <Text style={styles.filterGroupTitle}>Time</Text>
              <View style={styles.filterOptionRow}>
                {timeOptions.map((option) => {
                  const active = draftFilters.time === option.value;
                  return <TouchableOpacity key={option.value} style={[styles.filterOption, active && styles.filterOptionActive]} onPress={() => setDraftFilters((current) => ({ ...current, time: option.value as ExploreTimeFilter }))}>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{option.label}</Text>
                  </TouchableOpacity>;
                })}
              </View>

              <Text style={styles.filterGroupTitle}>Distance</Text>
              <View style={styles.filterOptionRow}>
                {distanceOptions.map((option) => {
                  const active = draftFilters.distanceKm === option.value;
                  return <TouchableOpacity key={option.label} style={[styles.filterOption, active && styles.filterOptionActive]} onPress={() => setDraftFilters((current) => ({ ...current, distanceKm: option.value }))}>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{option.label}</Text>
                  </TouchableOpacity>;
                })}
              </View>
              {(draftFilters.sortBy === 'nearest' || draftFilters.distanceKm !== null) ? (
                <Text style={styles.locationHint}>
                  {locationState === 'loading' ? 'Getting your location…' : locationState === 'unavailable' ? 'Location is unavailable. Soonest will be used without a distance limit.' : 'Your location is used privately for discovery only.'}
                </Text>
              ) : null}

              <Text style={styles.filterGroupTitle}>Category</Text>
              <View style={styles.filterOptionRow}>
                {categories.map((category) => {
                  const active = draftFilters.category === category;
                  return <TouchableOpacity key={category} style={[styles.filterOption, active && styles.filterOptionActive]} onPress={() => setDraftFilters((current) => ({ ...current, category }))}>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{category}</Text>
                  </TouchableOpacity>;
                })}
              </View>

              <Text style={styles.filterGroupTitle}>More filters · Age group</Text>
              <Text style={styles.filterGroupHint}>Activity suitability only—not profile filtering.</Text>
              <View style={styles.filterOptionRow}>
                {ageGroupOptions.map((option) => {
                  const active = draftFilters.ageGroup === option.value;
                  return <TouchableOpacity key={option.value} style={[styles.filterOption, active && styles.filterOptionActive]} onPress={() => setDraftFilters((current) => ({ ...current, ageGroup: option.value as ActivityAgeGroup }))}>
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>{option.label}</Text>
                  </TouchableOpacity>;
                })}
              </View>
              {filterError ? <Text style={styles.filterError}>{filterError}</Text> : null}
            </ScrollView>

            <View style={styles.filterActions}>
              <TouchableOpacity style={styles.resetButton} onPress={resetFilters}>
                <Text style={styles.resetButtonText}>Reset</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.applyButton} onPress={applyFilters} disabled={locationState === 'loading'}>
                <Text style={styles.applyButtonText}>{locationState === 'loading' ? 'Getting location…' : 'Apply filters'}</Text>
              </TouchableOpacity>
            </View>
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
    paddingHorizontal: 0,
    paddingTop: 8,
  },
  containerWeb: {
    height: '100dvh' as any,
    maxHeight: '100dvh' as any,
    paddingTop: 'calc(8px + env(safe-area-inset-top))' as any,
  },
  containerCompact: {
    paddingHorizontal: 0,
    paddingTop: 6,
  },
  topBar: {
    position: 'absolute',
    top: 22,
    left: 0,
    right: 0,
    zIndex: 30,
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 466,
    marginHorizontal: 'auto' as any,
    paddingHorizontal: 18,
    gap: 8,
  },
  topBarCompact: {
    top: 20,
    gap: 8,
  },
  filterBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 86,
    zIndex: 20,
    backgroundColor: 'rgba(0,0,0,0.26)',
    ...(Platform.OS === 'web' ? ({
      backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0.52) 0%, rgba(0,0,0,0.24) 62%, rgba(0,0,0,0) 100%)',
    } as any) : {}),
  },
  filterBackdropCompact: {
    height: 80,
  },
  filterBackdropFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -20,
    height: 40,
    backgroundColor: Platform.OS === 'web' ? 'transparent' : 'rgba(0,0,0,0.1)',
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
  filterButtonActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(35,29,13,0.98)',
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
  filterCount: {
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    marginLeft: 6,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  filterCountText: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: '900',
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
    maxWidth: 520,
    alignSelf: 'center',
    marginTop: 0,
    paddingHorizontal: 0,
    paddingBottom: Platform.OS === 'web'
      ? (`calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` as any)
      : BOTTOM_NAV_HEIGHT,
  },
  skeletonCard: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderRadius: 2,
    borderWidth: 0,
    padding: spacing.md,
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
  emptyState: {
    flex: 1,
    minHeight: 0,
    marginHorizontal: spacing.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyStateTitle: {
    color: colors.text,
    marginTop: spacing.md,
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  emptyStateText: {
    color: colors.textMuted,
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyResetButton: {
    marginTop: spacing.lg,
    borderRadius: 999,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
  },
  emptyResetText: {
    color: colors.primaryText,
    fontWeight: '900',
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
    maxHeight: '90%',
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  filterModalHeading: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.md,
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
    marginTop: spacing.md,
  },
  filterGroupHint: {
    color: colors.textSubtle,
    fontSize: 11,
    fontWeight: '700',
    marginTop: -4,
    marginBottom: spacing.sm,
  },
  filterOptionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
  },
  filterOption: {
    minHeight: 38,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    paddingHorizontal: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  filterOptionText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '800',
  },
  filterOptionTextActive: {
    color: colors.primaryText,
  },
  customDateRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  customDateInput: {
    flex: 1,
    minWidth: 0,
  },
  dateInput: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.sm,
    fontSize: 12,
    fontWeight: '700',
  },
  locationHint: {
    color: colors.textSubtle,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  filterError: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.md,
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
    flexShrink: 1,
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
  filterActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  resetButton: {
    minHeight: 46,
    paddingHorizontal: spacing.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: colors.primary,
    fontWeight: '900',
  },
  applyButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: colors.primaryText,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
});
