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
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { fetchActivity, joinActivityRequest } from '../api';
import { getAvatarUrl } from '../utils/avatar';
import { getActivityCoverImage } from '../utils/activityAssets';
import { getCuratedActivity } from '../utils/curatedActivities';

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

const discussionPreview = [
  { author: 'Mia', text: 'Can bring a friend if there is room?', time: '4m' },
  { author: 'Avery', text: 'Yes, two spots are still open.', time: '2m' },
];

export default function ActivityScreen({ route, navigation }: Props) {
  const { activityId } = route.params;
  const { token, user } = useAuth();
  const [activity, setActivity] = useState<ActivityDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadActivity = async () => {
      setLoading(true);
      setErrorMessage('');

      const curatedActivity = getCuratedActivity(activityId);
      if (curatedActivity) {
        setActivity(curatedActivity);
        setLoading(false);
        return;
      }

      try {
        const result = await fetchActivity(activityId, token || undefined);
        setActivity(result);
      } catch (error) {
        setActivity(null);
        setErrorMessage('This activity could not be loaded. Check that the backend is running, then try again.');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [activityId, token]);

  const handleJoin = async () => {
    if (getCuratedActivity(activityId)) {
      Alert.alert('Joined', 'You joined this curated activity.');
      return;
    }

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

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#f5c12d" />
        <Text style={styles.loadingText}>Loading activity...</Text>
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle-outline" size={34} color="#f5c12d" />
        <Text style={styles.errorTitle}>Activity unavailable</Text>
        <Text style={styles.errorText}>{errorMessage || 'This activity could not be loaded.'}</Text>
        <TouchableOpacity style={styles.errorButton} onPress={() => navigation.goBack()}>
          <Text style={styles.errorButtonText}>Back to activities</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const attendees = activity.attendees ?? activity.participants.length;
  const alreadyJoined = user ? activity.participants.some((participant) => participant.name === user.name) : false;
  const coverImage = activity.coverImage || getActivityCoverImage(activity.category, activity.id);
  const capacity = activity.maxAttendees ? `${attendees}/${activity.maxAttendees}` : `${attendees}`;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
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
          <View>
            <Text style={styles.title}>{activity.title}</Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="people-outline" size={16} color="#f5c12d" />
              <Text style={styles.heroMeta}>{capacity} participants</Text>
            </View>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.content}>
        <View style={styles.metadataGrid}>
          <View style={styles.metadataCard}>
            <Ionicons name="time-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Time</Text>
            <Text style={styles.metadataValue}>{activity.time || 'Anytime'}</Text>
          </View>
          <View style={styles.metadataCard}>
            <Ionicons name="location-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Place</Text>
            <Text style={styles.metadataValue} numberOfLines={1}>{activity.location}</Text>
          </View>
          <View style={styles.metadataCard}>
            <Ionicons name="navigate-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Distance</Text>
            <Text style={styles.metadataValue}>{activity.distance || 'Nearby'}</Text>
          </View>
          <View style={styles.metadataCard}>
            <Ionicons name="star-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Vibe</Text>
            <Text style={styles.metadataValue}>{activity.vibe || 'Social'}</Text>
          </View>
        </View>

        <View style={styles.hostCard}>
          <Image source={{ uri: activity.hostAvatar || getAvatarUrl(activity.host) }} style={styles.hostAvatar} />
          <View style={styles.hostDetails}>
            <Text style={styles.hostLabel}>Hosted by</Text>
            <Text style={styles.hostName}>{activity.host}</Text>
          </View>
          <View style={styles.hostBadge}>
            <Ionicons name="shield-checkmark-outline" size={15} color="#050505" />
            <Text style={styles.hostBadgeText}>Verified</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <Text style={styles.descriptionText}>{activity.description}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <View style={styles.participantsRow}>
            {activity.participants.slice(0, 5).map((participant, index) => (
              <Image
                key={`${participant.name}-${index}`}
                source={{ uri: participant.avatar || getAvatarUrl(participant.name) }}
                style={[styles.participantAvatar, { marginLeft: index === 0 ? 0 : -10 }]}
              />
            ))}
            <View style={styles.participantCount}>
              <Text style={styles.participantCountText}>{capacity}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Discussion</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}>
              <Text style={styles.sectionAction}>Open chat</Text>
            </TouchableOpacity>
          </View>
          {discussionPreview.map((message) => (
            <View key={`${message.author}-${message.time}`} style={styles.discussionRow}>
              <Image source={{ uri: getAvatarUrl(message.author) }} style={styles.discussionAvatar} />
              <View style={styles.discussionBubble}>
                <View style={styles.discussionMeta}>
                  <Text style={styles.discussionAuthor}>{message.author}</Text>
                  <Text style={styles.discussionTime}>{message.time}</Text>
                </View>
                <Text style={styles.discussionText}>{message.text}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.joinButton, alreadyJoined && styles.joinedButton]} onPress={handleJoin} disabled={alreadyJoined}>
            <Ionicons name={alreadyJoined ? 'checkmark-circle-outline' : 'add-circle-outline'} size={18} color={alreadyJoined ? '#888888' : '#050505'} />
            <Text style={[styles.joinButtonText, alreadyJoined && styles.joinedButtonText]}>
              {alreadyJoined ? 'Already joined' : 'Join activity'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}>
            <Ionicons name="chatbubbles-outline" size={18} color="#f5c12d" />
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#050505',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 14,
    color: '#fff',
  },
  errorTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '900',
    marginTop: 12,
  },
  errorText: {
    color: '#a8a8a8',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 300,
    marginTop: 8,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: '#f5c12d',
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginTop: 18,
  },
  errorButtonText: {
    color: '#050505',
    fontWeight: '900',
  },
  container: {
    backgroundColor: '#050505',
    paddingBottom: 28,
  },
  heroImage: {
    width: '100%',
    height: 290,
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.34)',
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
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 193, 45, 0.35)',
  },
  categoryBadgeText: {
    color: '#f5c12d',
    fontSize: 12,
    fontWeight: '900',
  },
  availabilityBadge: {
    backgroundColor: '#f5c12d',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  availabilityBadgeText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '900',
  },
  title: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 37,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  heroMeta: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 6,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  metadataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -4,
  },
  metadataCard: {
    width: '50%',
    padding: 4,
  },
  metadataLabel: {
    color: '#858585',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 7,
  },
  metadataValue: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
  },
  hostCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101010',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#242018',
    padding: 11,
    marginTop: 10,
  },
  hostAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: 11,
    borderWidth: 2,
    borderColor: '#f5c12d',
  },
  hostDetails: {
    flex: 1,
  },
  hostLabel: {
    color: '#8b8b8b',
    fontSize: 11,
    fontWeight: '700',
  },
  hostName: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    marginTop: 2,
  },
  hostBadge: {
    backgroundColor: '#f5c12d',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hostBadgeText: {
    color: '#050505',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 4,
  },
  section: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  sectionAction: {
    color: '#f5c12d',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 9,
  },
  descriptionText: {
    color: '#d1d1d1',
    fontSize: 14,
    lineHeight: 21,
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    borderColor: '#050505',
    backgroundColor: '#111111',
  },
  participantCount: {
    height: 42,
    minWidth: 54,
    borderRadius: 21,
    backgroundColor: '#f5c12d',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    marginLeft: -10,
  },
  participantCountText: {
    color: '#050505',
    fontWeight: '900',
    fontSize: 12,
  },
  discussionRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  discussionAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    marginRight: 9,
  },
  discussionBubble: {
    flex: 1,
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 10,
    padding: 10,
  },
  discussionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  discussionAuthor: {
    color: '#f5c12d',
    fontSize: 12,
    fontWeight: '900',
  },
  discussionTime: {
    color: '#777777',
    fontSize: 11,
  },
  discussionText: {
    color: '#eeeeee',
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 12,
  },
  joinButton: {
    flex: 1,
    backgroundColor: '#f5c12d',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 10,
  },
  joinButtonText: {
    color: '#050505',
    fontWeight: '900',
    fontSize: 14,
    marginLeft: 6,
  },
  joinedButton: {
    backgroundColor: '#242424',
  },
  joinedButtonText: {
    color: '#888888',
  },
  chatButton: {
    width: 50,
    borderWidth: 1,
    borderColor: '#f5c12d',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
