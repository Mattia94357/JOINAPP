import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AvatarBadge from '../components/AvatarBadge';
import { useAuth } from '../context/AuthContext';
import { fetchActivity, joinActivityRequest } from '../api';
import { getAvatarUrl } from '../utils/avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

type ActivityDetails = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  date?: string;
  time?: string;
  distance?: string;
  vibe?: string;
  attendees?: number;
  maxAttendees?: number;
  coverImage?: string;
  availabilityTag?: string;
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
  const coverImage =
    activity.coverImage ||
    `https://via.placeholder.com/400x250/1a1a1a/f5c12d?text=${encodeURIComponent(activity.category)}`;
  const capacity = activity.maxAttendees
    ? `${activity.attendees}/${activity.maxAttendees}`
    : `${activity.attendees} joined`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Hero Image */}
      <ImageBackground source={{ uri: coverImage }} style={styles.heroImage}>
        <View style={styles.heroOverlay} />
        <View style={styles.heroContent}>
          <View style={styles.heroBadges}>
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{activity.category}</Text>
            </View>
            {activity.availabilityTag && (
              <View style={styles.availabilityBadge}>
                <Text style={styles.availabilityBadgeText}>{activity.availabilityTag}</Text>
              </View>
            )}
          </View>
        </View>
      </ImageBackground>

      {/* Content */}
      <View style={styles.content}>
        {/* Title */}
        <Text style={styles.title}>{activity.title}</Text>

        {/* Quick Info */}
        <View style={styles.quickInfo}>
          <View style={styles.quickInfoItem}>
            <Text style={styles.quickInfoIcon}>📍</Text>
            <Text style={styles.quickInfoText}>{activity.location}</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <Text style={styles.quickInfoIcon}>🕐</Text>
            <Text style={styles.quickInfoText}>{activity.time || 'Anytime'}</Text>
          </View>
          <View style={styles.quickInfoItem}>
            <Text style={styles.quickInfoIcon}>📏</Text>
            <Text style={styles.quickInfoText}>{activity.distance || 'Nearby'}</Text>
          </View>
        </View>

        {/* Host Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Host</Text>
          <View style={styles.hostCard}>
            <Image
              source={{ uri: activity.hostAvatar || getAvatarUrl(activity.host) }}
              style={styles.hostAvatar}
            />
            <View style={styles.hostDetails}>
              <Text style={styles.hostName}>{activity.host}</Text>
              <Text style={styles.hostSubtitle}>Activity organizer</Text>
            </View>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About this experience</Text>
          <Text style={styles.descriptionText}>{activity.description}</Text>
        </View>

        {/* Vibe & Metadata */}
        <View style={styles.metadataRow}>
          <View style={styles.metadataCard}>
            <Text style={styles.metadataLabel}>Vibe</Text>
            <Text style={styles.metadataValue}>{activity.vibe || 'Social'}</Text>
          </View>
          <View style={styles.metadataCard}>
            <Text style={styles.metadataLabel}>Attendees</Text>
            <Text style={styles.metadataValue}>{capacity}</Text>
          </View>
        </View>

        {/* Participants */}
        {activity.participants.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Joined so far ({activity.participants.length})</Text>
            <View style={styles.participantsGrid}>
              {activity.participants.slice(0, 6).map((participant, index) => (
                <View key={index} style={styles.participantItem}>
                  <Image
                    source={{ uri: participant.avatar || getAvatarUrl(participant.name) }}
                    style={styles.participantAvatar}
                  />
                  <Text style={styles.participantName} numberOfLines={1}>
                    {participant.name}
                  </Text>
                </View>
              ))}
              {activity.participants.length > 6 && (
                <View style={styles.participantItem}>
                  <View style={styles.participantMoreOverlay}>
                    <Text style={styles.participantMoreText}>+{activity.participants.length - 6}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity
          style={[styles.joinButton, alreadyJoined && styles.joinedButton]}
          onPress={handleJoin}
          disabled={alreadyJoined}
        >
          <Text style={[styles.joinButtonText, alreadyJoined && styles.joinedButtonText]}>
            {alreadyJoined ? '✓ Already joined' : '🎉 Join this event'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.chatButton}
          onPress={() => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}
        >
          <Text style={styles.chatButtonText}>💬 Chat with participants</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
  },
  container: {
    backgroundColor: '#050505',
    paddingBottom: 40,
  },
  heroImage: {
    width: '100%',
    height: 240,
    position: 'relative',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  heroContent: {
    flex: 1,
    justifyContent: 'space-between',
    padding: 16,
  },
  heroBadges: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  categoryBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  categoryBadgeText: {
    color: '#f5c12d',
    fontSize: 12,
    fontWeight: '600',
  },
  availabilityBadge: {
    backgroundColor: 'rgba(245, 193, 45, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  availabilityBadgeText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 20,
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 16,
  },
  quickInfo: {
    flexDirection: 'row',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#222222',
  },
  quickInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
  },
  quickInfoIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  quickInfoText: {
    color: '#b8b8b8',
    fontSize: 13,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 12,
  },
  hostAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#f5c12d',
  },
  hostDetails: {
    flex: 1,
  },
  hostName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  hostSubtitle: {
    color: '#888888',
    fontSize: 12,
    marginTop: 2,
  },
  descriptionText: {
    color: '#d1d1d1',
    fontSize: 14,
    lineHeight: 22,
  },
  metadataRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  metadataCard: {
    flex: 1,
    backgroundColor: '#111111',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  metadataLabel: {
    color: '#888888',
    fontSize: 12,
    marginBottom: 4,
  },
  metadataValue: {
    color: '#f5c12d',
    fontSize: 16,
    fontWeight: '600',
  },
  participantsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  participantItem: {
    alignItems: 'center',
    width: '30%',
  },
  participantAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#f5c12d',
  },
  participantMoreOverlay: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f5c12d',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  participantMoreText: {
    color: '#050505',
    fontWeight: '700',
    fontSize: 12,
  },
  participantName: {
    color: '#b8b8b8',
    fontSize: 11,
    textAlign: 'center',
  },
  joinButton: {
    backgroundColor: '#f5c12d',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  joinButtonText: {
    color: '#050505',
    fontWeight: '700',
    fontSize: 14,
  },
  joinedButton: {
    backgroundColor: '#333333',
  },
  joinedButtonText: {
    color: '#888888',
  },
  chatButton: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#f5c12d',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatButtonText: {
    color: '#f5c12d',
    fontWeight: '700',
    fontSize: 14,
  },
});
