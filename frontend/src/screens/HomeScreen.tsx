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
import { colors, spacing } from '../theme';

const categories = ['All', 'Wellness', 'Food', 'Networking', 'Adventure'];

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user, token, updateUser } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 380;

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [photoRequiredVisible, setPhotoRequiredVisible] = useState(false);
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [participantsActivity, setParticipantsActivity] = useState<ActivityResponse | null>(null);
  const [tutorialStep, setTutorialStep] = useState(0);

  const showTutorial = user && !user.hasCompletedOnboardingTutorial;
  const tutorialScreens = [
    { title: 'Welcome to JOIN', text: 'Find real plans nearby and meet people through activities.' },
    { title: 'Join an activity', text: 'Tap Join Activity when something looks good.' },
    { title: 'Skip and keep browsing', text: 'Not your vibe? Swipe left or tap Skip to see the next plan.' },
    { title: 'Create your own plan', text: 'Want to make something happen? Host your own activity in under a minute.' },
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
        const result = await fetchActivities(token || undefined);
        setActivities(markJoinedActivities(result));
      } catch (error) {
        setMessage('Unable to fetch activities. Showing curated plans instead.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token, user?.id, user?.name]);

  const markJoinedActivities = (items: ActivityResponse[]) =>
    items.map((activity) => ({
      ...activity,
      joined: user
        ? activity.participants.some((participant) => participant.id === user.id || participant.name === user.name)
        : false,
      pending: user ? activity.pendingParticipants?.some((participant) => participant.id === user.id || participant.name === user.name) : false,
      waitlisted: user ? activity.waitlist?.some((participant) => participant.id === user.id || participant.name === user.name) : false,
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

  const handleJoinActivity = async (activity: ActivityResponse) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to join this activity.');
      return;
    }

    const hasProfilePhoto = Boolean(user?.profilePictureUrl || user?.profileThumbnailUrl);
    if (!hasProfilePhoto) {
      showProfilePhotoRequired();
      return;
    }

    try {
      const response = await joinActivityRequest(activity.id, token);
      const status = response.data?.status;
      if (status === 'pending') {
        Alert.alert('Request sent', 'The host will review your request.');
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
    } catch (error: any) {
      console.warn(error);
      if (error?.response?.data?.code === 'PROFILE_PHOTO_REQUIRED') {
        showProfilePhotoRequired();
        return;
      }
      Alert.alert('Unable to join', error?.response?.data?.message || 'There was an issue joining this activity.');
    }
  };

  const handleSaveActivity = async (activity: ActivityResponse) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to save activities.');
      return;
    }

    try {
      await saveActivityRequest(activity.id, token);
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

  return (
    <SafeAreaView style={[styles.container, compact && styles.containerCompact]}>
      <View style={styles.topBar}>
        <View style={styles.headingBlock}>
          <Text style={styles.greeting}>Hello, {user?.name || 'guest'}</Text>
          <Text style={styles.title}>Find your next plan</Text>
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
            Browse Categories{selectedCategory !== 'All' ? ` - ${selectedCategory}` : ''}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.hostButtonSmall}
          onPress={() => navigation.navigate('CreateActivity')}
        >
          <Ionicons name="add-outline" size={22} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.deckContainer}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <SwipeDeck
            key={`${selectedCategory}-${activeFeed.length}`}
            activities={activeFeed}
            onSwipeLeft={() => setMessage('Skipped. Keep browsing quality plans.')}
            onSwipeRight={handleJoinActivity}
            onSave={handleSaveActivity}
            onPress={handlePress}
            onOpenChat={(activity) => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}
            onViewParticipants={setParticipantsActivity}
            onOpenProfile={openPublicProfile}
          />
        )}
      </View>

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
            <Text style={styles.modalTitle}>Browse Categories</Text>

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
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  containerCompact: {
    paddingHorizontal: spacing.md,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  headingBlock: {
    flex: 1,
    paddingRight: spacing.md,
  },
  greeting: {
    color: colors.textMuted,
    fontSize: 13,
    marginBottom: spacing.xs,
    fontWeight: '700',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 33,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cleanControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  browseCategoriesButton: {
    flex: 1,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
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
  hostButtonSmall: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deckContainer: {
    flex: 1,
    marginTop: spacing.sm,
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
  modalCategoryItem: {
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.background,
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
