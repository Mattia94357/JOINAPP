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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AvatarBadge from '../components/AvatarBadge';
import SwipeDeck from '../components/SwipeDeck';
import { useAuth } from '../context/AuthContext';
import { ActivityResponse, fetchActivities, joinActivityRequest } from '../api';
import { Ionicons } from '@expo/vector-icons';

const categories = ['All', 'Wellness', 'Food', 'Networking', 'Adventure'];

const suggestionActivities: ActivityResponse[] = [
  {
    id: 'template-1',
    title: 'Sunset rooftop dinner',
    category: 'Food',
    location: 'Downtown Skyline',
    description: 'An elevated evening with small plates, thoughtful conversation, and city views.',
    date: 'Tonight',
    time: '7:30 PM',
    distance: '1.1 km',
    vibe: 'Curated',
    attendees: 6,
    host: 'Avery',
    hostId: 'host-1',
    participants: [],
  },
  {
    id: 'template-2',
    title: 'Morning hike + coffee',
    category: 'Adventure',
    location: 'River Trail',
    description: 'A scenic 5K with a coffee stop for easy pace, good company, and fresh air.',
    date: 'Saturday',
    time: '9:00 AM',
    distance: '2.4 km',
    vibe: 'Active',
    attendees: 8,
    host: 'Jordan',
    hostId: 'host-2',
    participants: [],
  },
  {
    id: 'template-3',
    title: 'Creative co-working lounge',
    category: 'Networking',
    location: 'Union House',
    description: 'Make progress, exchange ideas, and stay inspired with a curated work circle.',
    date: 'Monday',
    time: '3:00 PM',
    distance: '800 m',
    vibe: 'Focused',
    attendees: 5,
    host: 'Sam',
    hostId: 'host-3',
    participants: [],
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user, token, logout } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activities, setActivities] = useState<ActivityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const filteredActivities = useMemo(
    () =>
      selectedCategory === 'All'
        ? activities
        : activities.filter((activity) => activity.category === selectedCategory),
    [activities, selectedCategory],
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

  const activeFeed = filteredActivities.length > 0 ? filteredActivities : suggestionActivities;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.name || 'guest'}</Text>
          <Text style={styles.title}>Discover premium local plans</Text>
        </View>
        <View style={styles.actionIcons}>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color="#f5c12d" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.iconButton}>
            <AvatarBadge name={user?.name || 'Guest'} avatarUrl={user?.avatar} size={40} />
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

      <View style={styles.statsRow}>
        <View>
          <Text style={styles.statLabel}>Curated matches</Text>
          <Text style={styles.statValue}>{activeFeed.length}</Text>
        </View>
        <View>
          <Text style={styles.statLabel}>Ready to join</Text>
          <Text style={styles.statValue}>{loading ? 'Loading…' : selectedCategory === 'All' ? 'Live now' : selectedCategory}</Text>
        </View>
      </View>

      <View style={styles.deckContainer}>
        {loading ? (
          <ActivityIndicator color="#f5c12d" size="large" />
        ) : (
          <SwipeDeck
            key={`${selectedCategory}-${activeFeed.length}`}
            activities={activeFeed}
            onSwipeLeft={() => setMessage('Skipped. Keep browsing high-quality plans.')}
            onSwipeRight={handleSwipeRight}
            onPress={handlePress}
          />
        )}
      </View>

      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Text style={styles.secondaryText}>Host an experience</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate('Chat', { chatId: 'general', title: 'Community Chat' })}>
          <Text style={styles.primaryText}>Join chat</Text>
        </TouchableOpacity>
      </View>

      {message ? <Text style={styles.statusText}>{message}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  greeting: {
    color: '#aaa',
    fontSize: 14,
    marginBottom: 4,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    lineHeight: 34,
  },
  actionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    marginLeft: 14,
  },
  categoryRow: {
    maxHeight: 56,
  },
  categoryRowContent: {
    paddingBottom: 10,
  },
  categoryTag: {
    borderWidth: 1,
    borderColor: '#262626',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginRight: 10,
    backgroundColor: '#101010',
  },
  categoryTagActive: {
    backgroundColor: '#f5c12d',
    borderColor: '#f5c12d',
  },
  categoryText: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  categoryTextActive: {
    color: '#050505',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  statLabel: {
    color: '#777',
    fontSize: 12,
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  deckContainer: {
    flex: 1,
    marginTop: 18,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 20,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#f5c12d',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
    marginRight: 10,
  },
  secondaryText: {
    color: '#f5c12d',
    fontWeight: '700',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#f5c12d',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryText: {
    color: '#050505',
    fontWeight: '800',
  },
  statusText: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
});
