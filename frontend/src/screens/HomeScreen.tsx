import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AvatarBadge from '../components/AvatarBadge';
import SwipeDeck from '../components/SwipeDeck';
import { useAuth } from '../context/AuthContext';
import { ActivityResponse, fetchActivities, joinActivityRequest } from '../api';

const categories = ['All', 'Wellness', 'Food', 'Networking', 'Adventure'];

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
      try {
        const result = await fetchActivities(token || undefined);
        setActivities(result);
      } catch (error) {
        setMessage('Unable to fetch activities.');
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerProfile}>
          <AvatarBadge name={user?.name || 'Guest'} avatarUrl={user?.avatar} size={48} />
          <View style={styles.headerText}>
            <Text style={styles.title}>Discover Activities</Text>
            <Text style={styles.subtitle}>Hello, {user?.name || 'guest'}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.hostButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Text style={styles.hostButtonText}>Host</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.categoryRow}>
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
      </View>
      <View style={styles.deckContainer}>
        {loading ? (
          <ActivityIndicator color="#f5c12d" size="large" />
        ) : (
          <SwipeDeck
            key={`${selectedCategory}-${filteredActivities.length}`}
            activities={filteredActivities}
            onSwipeLeft={() => {
              setMessage('Swipe left to pass.');
            }}
            onSwipeRight={handleSwipeRight}
            onPress={handlePress}
          />
        )}
      </View>
      <View style={styles.footerRow}>
        <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('Chat', { chatId: 'general', title: 'Community Chat' })}>
          <Text style={styles.chatButtonText}>Community Chat</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
      {message ? <Text style={styles.statusText}>{message}</Text> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    paddingHorizontal: 18,
  },
  header: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerProfile: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    marginLeft: 14,
  },
  title: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '900',
  },
  subtitle: {
    marginTop: 6,
    color: '#ccc',
    fontSize: 14,
  },
  hostButton: {
    backgroundColor: '#f5c12d',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  hostButtonText: {
    color: '#000',
    fontWeight: '700',
  },
  categoryRow: {
    marginTop: 20,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryTag: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
    marginRight: 8,
  },
  categoryTagActive: {
    backgroundColor: '#f5c12d',
    borderColor: '#f5c12d',
  },
  categoryText: {
    color: '#eee',
    fontSize: 14,
  },
  categoryTextActive: {
    color: '#000',
  },
  deckContainer: {
    flex: 1,
    marginTop: 20,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 18,
  },
  chatButton: {
    flex: 1,
    backgroundColor: '#111',
    borderColor: '#f5c12d',
    borderWidth: 1,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginRight: 10,
  },
  chatButtonText: {
    color: '#f5c12d',
    fontWeight: '700',
  },
  logoutButton: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f5c12d',
  },
  logoutText: {
    color: '#f5c12d',
    fontWeight: '700',
  },
  statusText: {
    color: '#fff',
    textAlign: 'center',
    marginBottom: 16,
  },
});
