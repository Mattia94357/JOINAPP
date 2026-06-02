import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AvatarBadge from '../components/AvatarBadge';
import SwipeDeck from '../components/SwipeDeck';
import ParticipantsModal from '../components/ParticipantsModal';
import { useAuth } from '../context/AuthContext';
import { ActivityResponse, fetchActivities, joinActivityRequest } from '../api';
import { availabilityOptions } from '../utils/availability';
import { curatedActivities } from '../utils/curatedActivities';
import { colors, spacing } from '../theme';

const categories = ['All', 'Wellness', 'Food', 'Networking', 'Adventure'];

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user, token } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAvailability, setSelectedAvailability] = useState('All');
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [participantsActivity, setParticipantsActivity] = useState<ActivityResponse | null>(null);

  const filteredActivities = useMemo(
    () =>
      activities.filter((activity) => {
        const matchesCategory = selectedCategory === 'All' || activity.category === selectedCategory;
        const matchesAvailability = selectedAvailability === 'All' || activity.availabilityTag === selectedAvailability;
        return matchesCategory && matchesAvailability;
      }),
    [activities, selectedAvailability, selectedCategory],
  );

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setMessage('');
      try {
        const result = await fetchActivities(token || undefined);
        setActivities(result);
      } catch (error) {
        setMessage('Unable to fetch activities. Explore curated templates below.');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [token]);

  const refreshActivities = async () => {
    try {
      const result = await fetchActivities(token || undefined);
      setActivities(result);
    } catch (error) {
      console.warn(error);
    }
  };

  const handleSwipeRight = async (activity: ActivityResponse) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to join this activity.');
      return;
    }

    if (!user?.profileCompleted && !user?.profilePictureUrl && !user?.avatar) {
      Alert.alert(
        'Profile photo required',
        'Profile photos are required before joining. This helps everyone see who is attending and keeps JOIN trusted.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upload photo', onPress: () => navigation.navigate('Profile') },
        ],
      );
      return;
    }

    try {
      await joinActivityRequest(activity.id, token);
      Alert.alert('Joined', `You joined ${activity.title}.`);
      await refreshActivities();
    } catch (error) {
      console.warn(error);
      Alert.alert('Unable to join', 'There was an issue joining this event.');
    }
  };

  const handlePress = (activity: ActivityResponse) => {
    navigation.navigate('Activity', { activityId: activity.id });
  };

  const activeFeed = filteredActivities.length > 0 ? filteredActivities : curatedActivities;
  const nearbyCount = activeFeed.length;
  const activeTonight = activeFeed.reduce((total, activity) => total + (activity.attendees ?? activity.participants.length), 0);
  const nextStarts = activeFeed[0]?.time || 'Soon';

  return (
    <SafeAreaView style={styles.container}>
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
            <AvatarBadge name={user?.name || 'Guest'} avatarUrl={user?.avatar} size={38} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow} contentContainerStyle={styles.categoryRowContent}>
        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[styles.categoryTag, selectedCategory === category && styles.categoryTagActive]}
            onPress={() => setSelectedCategory(category)}
          >
            <Text style={[styles.categoryText, selectedCategory === category && styles.categoryTextActive]}>
              {category}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.availabilityRow} contentContainerStyle={styles.availabilityRowContent}>
        {availabilityOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.availabilityChip, selectedAvailability === option && styles.availabilityChipActive]}
            onPress={() => setSelectedAvailability(option)}
          >
            <Text style={[styles.availabilityText, selectedAvailability === option && styles.availabilityTextActive]}>
              {option}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>{nearbyCount === 1 ? 'Activity nearby' : 'Activities nearby'}</Text>
          <Text style={styles.statValue}>{nearbyCount}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Next starts</Text>
          <Text style={styles.statValue}>{loading ? 'Loading...' : nextStarts}</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statLabel}>Active tonight</Text>
          <Text style={styles.statValue}>{activeTonight} people</Text>
        </View>
      </View>

      <View style={styles.deckContainer}>
        {loading ? (
          <ActivityIndicator color={colors.primary} size="large" />
        ) : (
          <SwipeDeck
            key={`${selectedCategory}-${selectedAvailability}-${activeFeed.length}`}
            activities={activeFeed}
            onSwipeLeft={() => setMessage('Saved for later. Keep browsing quality plans.')}
            onSwipeRight={handleSwipeRight}
            onPress={handlePress}
            onViewParticipants={setParticipantsActivity}
            onOpenProfile={(participant) => navigation.navigate('PublicProfile', { userId: participant.id, fallbackName: participant.name, fallbackAvatar: participant.avatar })}
          />
        )}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Ionicons name="add-circle-outline" size={17} color={colors.text} />
          <Text style={styles.secondaryText}>Host</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Chat', { chatId: 'general', title: 'Community Chat' })}>
          <Ionicons name="chatbubbles-outline" size={17} color={colors.primaryText} />
          <Text style={styles.primaryText}>Chat</Text>
        </TouchableOpacity>
      </View>

      {message ? <Text style={styles.statusText}>{message}</Text> : null}
      <ParticipantsModal
        visible={Boolean(participantsActivity)}
        participants={participantsActivity?.participants || []}
        onClose={() => setParticipantsActivity(null)}
        onOpenProfile={(participant) => {
          setParticipantsActivity(null);
          navigation.navigate('PublicProfile', { userId: participant.id, fallbackName: participant.name, fallbackAvatar: participant.avatar });
        }}
      />
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
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  categoryRow: {
    maxHeight: 46,
  },
  categoryRowContent: {
    paddingBottom: spacing.sm,
  },
  categoryTag: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginRight: spacing.sm,
    backgroundColor: colors.surface,
  },
  categoryTagActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  categoryText: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  categoryTextActive: {
    color: colors.primaryText,
  },
  availabilityRow: {
    maxHeight: 42,
  },
  availabilityRowContent: {
    paddingBottom: spacing.sm,
  },
  availabilityChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 7,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    backgroundColor: colors.background,
  },
  availabilityChipActive: {
    borderColor: colors.accent,
    backgroundColor: colors.surfaceElevated,
  },
  availabilityText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  availabilityTextActive: {
    color: colors.accent,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  statBlock: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
  },
  statLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  deckContainer: {
    flex: 1,
    marginTop: spacing.md,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: spacing.md,
    gap: spacing.md,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.text,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  primaryText: {
    color: colors.primaryText,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
  statusText: {
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: '700',
  },
});
