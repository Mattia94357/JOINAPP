import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AvatarBadge from '../components/AvatarBadge';
import { useAuth } from '../context/AuthContext';
import { fetchActivity, joinActivityRequest } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

type ActivityDetails = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  date?: string;
  host: string;
  hostId: string;
  hostAvatar?: string;
  participants: Array<{ name: string; avatar?: string }>;
};

export default function ActivityScreen({ route, navigation }: Props) {
  const { activityId } = route.params;
  const { token, user } = useAuth();
  const [activity, setActivity] = useState<ActivityDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadActivity = async () => {
      setLoading(true);
      try {
        const result = await fetchActivity(activityId, token || undefined);
        setActivity(result);
      } catch (error) {
        Alert.alert('Unable to load activity', 'Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [activityId, token]);

  const handleJoin = async () => {
    if (!token) {
      Alert.alert('Please log in', 'You must be signed in to join this activity.');
      return;
    }

    try {
      await joinActivityRequest(activityId, token);
      Alert.alert('Joined', 'You are now part of this activity.');
      const result = await fetchActivity(activityId, token);
      setActivity(result);
    } catch (error) {
      console.warn(error);
      Alert.alert('Could not join', 'You may already be joined or there was a network issue.');
    }
  };

  if (loading || !activity) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f5c12d" />
        <Text style={styles.loadingText}>Loading event details...</Text>
      </View>
    );
  }

  const alreadyJoined = user ? activity.participants.some((participant) => participant.name === user.name) : false;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.topCard}>
        <Text style={styles.category}>{activity.category}</Text>
        <Text style={styles.title}>{activity.title}</Text>
        <Text style={styles.info}>{activity.location} • {activity.date || 'Flexible time'}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Host</Text>
        <Text style={styles.sectionText}>{activity.host}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Description</Text>
        <Text style={styles.sectionText}>{activity.description}</Text>
      </View>
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Participants</Text>
        <View style={styles.participantsRow}>
          {activity.participants.map((participant) => (
            <View key={participant.name} style={styles.participantBadge}>
              <AvatarBadge name={participant.name} avatarUrl={participant.avatar} size={42} />
              <Text style={styles.participantName}>{participant.name}</Text>
            </View>
          ))}
        </View>
      </View>
      <TouchableOpacity style={[styles.button, alreadyJoined && styles.disabledButton]} onPress={handleJoin} disabled={alreadyJoined}>
        <Text style={[styles.buttonText, alreadyJoined && styles.disabledText]}>
          {alreadyJoined ? 'Already joined' : 'Join this event'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}>
        <Text style={styles.chatButtonText}>Chat with participants</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
  },
  container: {
    backgroundColor: '#000',
    padding: 20,
    paddingBottom: 40,
  },
  topCard: {
    backgroundColor: '#111',
    borderRadius: 24,
    padding: 24,
    borderColor: '#333',
    borderWidth: 1,
  },
  category: {
    color: '#f5c12d',
    fontSize: 14,
    letterSpacing: 1,
    marginBottom: 10,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 12,
  },
  info: {
    color: '#bbb',
    fontSize: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  sectionText: {
    color: '#eee',
    fontSize: 16,
    lineHeight: 24,
  },
  participantsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  participantBadge: {
    backgroundColor: '#111',
    borderColor: '#444',
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 999,
    marginRight: 10,
    marginBottom: 10,
  },
  participantText: {
    color: '#f5c12d',
    fontWeight: '700',
  },
  participantName: {
    color: '#eee',
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
    maxWidth: 80,
  },
  button: {
    marginTop: 32,
    backgroundColor: '#f5c12d',
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#000',
    fontWeight: '800',
    fontSize: 16,
  },
  disabledButton: {
    backgroundColor: '#333',
  },
  disabledText: {
    color: '#777',
  },
  chatButton: {
    marginTop: 16,
    backgroundColor: '#111',
    borderColor: '#f5c12d',
    borderWidth: 1,
    paddingVertical: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#f5c12d',
    fontWeight: '800',
    fontSize: 16,
  },
});
