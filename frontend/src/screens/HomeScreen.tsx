import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AvatarBadge from '../components/AvatarBadge';
import SwipeDeck from '../components/SwipeDeck';
import ParticipantsModal from '../components/ParticipantsModal';
import { useAuth } from '../context/AuthContext';
import { ActivityResponse, fetchActivities, joinActivityRequest, saveActivityRequest, updateProfileRequest, updatePushTokenRequest } from '../api';
import { curatedActivities } from '../utils/curatedActivities';
import { registerForPushNotificationsAsync } from '../utils/notifications';
import { activityCategories } from '../utils/categories';
import { colors, spacing } from '../theme';

const categories = ['All', ...activityCategories];
const hostGenderFilters = [
  { label: 'All hosts', value: 'all' },
  { label: 'Male hosts', value: 'male' },
  { label: 'Female hosts', value: 'female' },
  { label: 'Non-binary hosts', value: 'non_binary' },
] as const;
type HostGenderFilter = typeof hostGenderFilters[number]['value'];

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user, token, updateUser } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedHostGender, setSelectedHostGender] = useState<HostGenderFilter>('all');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [photoRequiredVisible, setPhotoRequiredVisible] = useState(false);
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [participantsActivity, setParticipantsActivity] = useState<ActivityResponse | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);

  const showTutorial = user && !user.hasCompletedOnboardingTutorial;
  const tutorialScreens = [
    { icon: 'compass-outline', title: 'Discover real plans', text: "Browse activities nearby and see what's happening. Swipe left to skip or use the Skip button." },
    { icon: 'add-circle-outline', title: 'Join or ask to join', text: 'Swipe right to join or tap Join Activity. Private plans use Ask to Join.' },
    { icon: 'people-outline', title: "See who's going", text: 'View hosts and participants before you join.' },
    { icon: 'star-outline', title: 'Host your own', text: 'Create a plan in under a minute and invite people in.' },
  ];

  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) => {
        return selectedCategory === 'All' || activity.category === selectedCategory;
      }),
    [activities, selectedCategory],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage('');

      try {
        const result = await fetchActivities(token || undefined, selectedHostGender === 'all' ? undefined : { hostGender: selectedHostGender });
        setActivities(markJoinedActivities(result));
      } catch (error) {
        setMessage('Unable to fetch activities. Showing curated plans instead.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, user?.id, user?.name, selectedHostGender]);

  const markJoinedActivities = (items: ActivityResponse[]) =>
    items.map((activity) => ({
      ...activity,
      joined: user
        ? activity.participants.some((participant) => participant.id === user.id || participant.name === user.name)
        : false,
      pending: activity.pending || (user ? activity.pendingParticipants?.some((participant) => participant.id === user.id || participant.name === user.name) : false),
      declined: activity.declined || (user ? activity.declinedParticipants?.some((participant) => participant.id === user.id || participant.name === user.name) : false),
      waitlisted: activity.waitlisted || (user ? activity.waitlist?.some((participant) => participant.id === user.id || participant.name === user.name) : false),
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
    if (activity.joined) {
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
      await refreshActivities();
      return true;
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

  const finishTutorial = async () => {
    if (!token) return;
    try {
      const response = await updateProfileRequest({ hasCompletedOnboardingTutorial: true }, token);
      await updateUser(response.data);
    } catch (error) {
      console.warn('Unable to finish onboarding tutorial', error);
    }
  };

  const skipTutorial = () => {
    finishTutorial();
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

  const activeFeed = filteredActivities.length > 0 ? filteredActivities : curatedActivities;
  const hasNoCategoryResults = !loading && selectedCategory !== 'All' && activities.length > 0 && filteredActivities.length === 0;
  const visibleFeed = hasNoCategoryResults ? [] : activeFeed;

  return (
    <SafeAreaView style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.topBar}>
        <View style={styles.headingBlock}>
          <Text style={styles.title}>Discover</Text>
          <Text style={styles.subtitle}>Real plans nearby</Text>
        </View>

        <View style={styles.actionIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={21} color={colors.text} />
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.iconButton}>
            <AvatarBadge
              name={user?.name || 'Guest'}
              avatarUrl={user?.profileThumbnailUrl || user?.profilePictureUrl}
              size={38}
            />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.cleanControls}>
        <TouchableOpacity
          style={styles.browseCategoriesButton}
          onPress={() => setCategoryModalVisible(true)}
        >
          <Ionicons name="grid-outline" size={17} color={colors.primaryText} />
          <Text style={styles.browseCategoriesText}>
            Filters{selectedCategory !== 'All' ? ` - ${selectedCategory}` : ''}{selectedHostGender !== 'all' ? ` - ${hostGenderFilters.find((item) => item.value === selectedHostGender)?.label}` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.hostButton}
          onPress={() => navigation.navigate('CreateActivity')}
        >
          <Ionicons name="add-outline" size={18} color={colors.primary} />
          <Text style={styles.hostButtonText}>Host</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.curatedStrip}>
        {['Featured tonight', 'Curated near you', 'Small group'].map((label) => (
          <View key={label} style={styles.curatedChip}>
            <Ionicons name="star-outline" size={12} color={colors.primary} />
            <Text style={styles.curatedChipText}>{label}</Text>
          </View>
        ))}
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
              setMessage('Skipped. Keep browsing quality plans.');
              return true;
            }}
            onSwipeRight={handleJoinActivity}
            onSave={handleSaveActivity}
            onPress={handlePress}
            onOpenChat={(activity) => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}
            onViewParticipants={setParticipantsActivity}
            onOpenProfile={openPublicProfile}
          />
        )}
      </View>

      {hasNoCategoryResults ? <Text style={styles.statusText}>No {selectedCategory} activities yet. Try another category or host the first one.</Text> : null}
      {message ? <Text style={styles.statusText}>{message}</Text> : null}

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
        onRequestClose={finishTutorial}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.tutorialModal}>
            <View style={styles.tutorialHero}>
              <View style={styles.tutorialIcon}>
                <Ionicons name={tutorialScreens[tutorialStep].icon as any} size={24} color={colors.primaryText} />
              </View>
              <View style={styles.tutorialPreviewCard}>
                <Text style={styles.tutorialPreviewEyebrow}>Featured tonight</Text>
                <Text style={styles.tutorialPreviewTitle}>Small dinner circle</Text>
                <Text style={styles.tutorialPreviewMeta}>6 going - Verified host</Text>
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
                  finishTutorial();
                } else {
                  setTutorialStep((step) => step + 1);
                }
              }}
            >
              <Text style={styles.photoRequiredPrimaryText}>{tutorialStep >= tutorialScreens.length - 1 ? 'Start exploring' : 'Next'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoRequiredSecondary} onPress={skipTutorial}>
              <Text style={styles.photoRequiredSecondaryText}>Skip</Text>
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
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  containerCompact: {
    paddingHorizontal: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  headingBlock: {
    flex: 1,
    paddingRight: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 32,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    marginTop: 2,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cleanControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  curatedStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: 6,
  },
  curatedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  curatedChipText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
    marginLeft: 4,
  },
  browseCategoriesButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    minHeight: 44,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  browseCategoriesText: {
    color: colors.primaryText,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
  hostButton: {
    minWidth: 86,
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
  },
  hostButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 5,
  },
  deckContainer: {
    flex: 1,
    marginTop: 2,
  },
  skeletonCard: {
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
    height: 176,
    borderRadius: 10,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  categoryModal: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  photoRequiredModal: {
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
