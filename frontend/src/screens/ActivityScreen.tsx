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
  Linking,
  Modal,
  Platform,
  Share,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import {
  approveJoinRequest,
  cancelActivityRequest,
  declineJoinRequest,
  deleteMomentRequest,
  fetchActivity,
  fetchActivityMomentsRequest,
  joinActivityRequest,
  likeMomentRequest,
  MomentResponse,
  unlikeMomentRequest,
} from '../api';
import AvatarBadge from '../components/AvatarBadge';
import ParticipantsModal from '../components/ParticipantsModal';
import { getActivityCoverImage } from '../utils/activityAssets';
import { getCuratedActivity } from '../utils/curatedActivities';
import MomentCard from '../components/MomentCard';
import CreateMomentModal from '../components/CreateMomentModal';
import MomentCommentsSection from '../components/MomentCommentsSection';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

type ActivityDetails = {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  date?: string;
  startsAt?: string;
  time?: string;
  distance?: string;
  ageGroup?: 'any' | '18-24' | '25-34' | '35-44' | '45+';
  vibe?: string;
  attendees?: number;
  maxAttendees?: number;
  coverImage?: string;
  availabilityTag?: string;
  visibility?: 'public' | 'private';
  joinApproval?: 'auto' | 'manual';
  status?: 'active' | 'full' | 'cancelled' | 'completed';
  cancellationReason?: string;
  galleryImages?: string[];
  host: string;
  hostId: string;
  hostAvatar?: string;
  hostRating?: number;
  hostHostedCount?: number;
  hostJoinedCount?: number;
  hostReviewCount?: number;
  hostVerified?: boolean;
  participants: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }>;
  pendingParticipants?: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }>;
  declinedParticipants?: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }>;
  waitlist?: Array<{ id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }>;
  inviteCode?: string;
};

export default function ActivityScreen({ route, navigation }: Props) {
  const { activityId, inviteCode } = route.params;
  const { token, user } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 380;
  const [activity, setActivity] = useState<ActivityDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [participantsVisible, setParticipantsVisible] = useState(false);
  const [photoRequiredVisible, setPhotoRequiredVisible] = useState(false);
  const [moments, setMoments] = useState<MomentResponse[]>([]);
  const [momentsLoading, setMomentsLoading] = useState(false);
  const [momentError, setMomentError] = useState('');
  const [createMomentVisible, setCreateMomentVisible] = useState(false);
  const [busyMomentId, setBusyMomentId] = useState<string>();
  const [commentMomentId, setCommentMomentId] = useState<string>();

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
        const result = await fetchActivity(activityId, token || undefined, inviteCode);
        setActivity(result);
      } catch (error) {
        setActivity(null);
        setErrorMessage('This activity could not be loaded. Check that the backend is running, then try again.');
      } finally {
        setLoading(false);
      }
    };

    loadActivity();
  }, [activityId, inviteCode, token]);

  useEffect(() => {
    let active = true;
    const loadMoments = async () => {
      if (getCuratedActivity(activityId)) return;
      setMomentsLoading(true);
      setMomentError('');
      try {
        const response = await fetchActivityMomentsRequest(activityId, token || undefined);
        if (active) setMoments(response.data || []);
      } catch (error: any) {
        if (active) {
          setMoments([]);
          setMomentError(error?.response?.status === 403 ? '' : 'Moments are temporarily unavailable.');
        }
      } finally {
        if (active) setMomentsLoading(false);
      }
    };
    loadMoments();
    return () => { active = false; };
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

    const hasProfilePhoto = Boolean(user?.profilePictureUrl || user?.profileThumbnailUrl);
    if (!hasProfilePhoto) {
      setPhotoRequiredVisible(true);
      return;
    }

    try {
      const status = (await joinActivityRequest(activityId, token, inviteCode)).data?.status;
      if (status === 'pending') {
        Alert.alert('Request sent', 'The host will review your request.');
      } else if (status === 'declined') {
        Alert.alert('Request declined', 'The host declined this request.');
      } else if (status === 'waitlisted') {
        Alert.alert('Waitlist joined', 'This activity is full, so you joined the waitlist.');
      } else {
        Alert.alert('Joined', 'You are now part of this activity.');
      }
      const result = await fetchActivity(activityId, token, inviteCode);
      setActivity(result);
    } catch (error: any) {
      console.warn(error);
      if (error?.response?.data?.code === 'PROFILE_PHOTO_REQUIRED') {
        setPhotoRequiredVisible(true);
        return;
      }
      Alert.alert('Could not join', error?.response?.data?.message || 'You may already be joined or there was a network issue.');
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
  const alreadyJoined = user
    ? activity.participants.some((participant) => participant.id === user.id || participant.name === user.name)
    : false;
  const coverImage = activity.coverImage || getActivityCoverImage(activity.category, activity.id);
  const capacity = activity.maxAttendees ? `${attendees}/${activity.maxAttendees}` : `${attendees}`;
  const isHost = user?.id === activity.hostId;
  const pendingApproval = user ? activity.pendingParticipants?.some((participant) => participant.id === user.id || participant.name === user.name) : false;
  const requestDeclined = user ? activity.declinedParticipants?.some((participant) => participant.id === user.id || participant.name === user.name) : false;
  const waitlisted = user ? activity.waitlist?.some((participant) => participant.id === user.id || participant.name === user.name) : false;
  const isFull = activity.status === 'full' || Boolean(activity.maxAttendees && attendees >= activity.maxAttendees);
  const isCancelled = activity.status === 'cancelled';
  const hasActivityStarted = activity.status === 'completed'
    || Boolean(activity.startsAt && new Date(activity.startsAt).getTime() <= Date.now());
  const isPastOrCompleted = activity.status === 'completed' || hasActivityStarted;
  const canCreateMoment = Boolean(token && (alreadyJoined || isHost) && !isCancelled && hasActivityStarted);
  const canOpenChat = alreadyJoined || isHost;
  const hostRating = activity.hostRating ? activity.hostRating.toFixed(1) : 'New';
  const joinLabel = alreadyJoined
    ? 'Already joined'
    : requestDeclined
      ? 'Request Declined'
    : pendingApproval
      ? 'Request Pending'
      : waitlisted
        ? 'On Waitlist'
        : isCancelled
          ? 'Cancelled'
          : isPastOrCompleted
            ? 'Activity completed'
          : isFull
            ? 'Join Waitlist'
            : activity.visibility === 'private'
              ? 'Ask to Join'
              : activity.joinApproval === 'manual'
                ? 'Ask to Join'
              : 'Join activity';

  const getShareMessage = (prefix: string, includePrivateInvite = false) => {
    const timeText = activity.time || activity.date || 'Anytime';
    let activityUrl = Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : '';
    if (activityUrl && includePrivateInvite && activity.inviteCode) {
      const inviteUrl = new URL(activityUrl);
      inviteUrl.searchParams.set('inviteCode', activity.inviteCode);
      activityUrl = inviteUrl.toString();
    }
    return [
      prefix,
      `${activity.title}`,
      `${activity.location} · ${timeText}`,
      activity.description,
      includePrivateInvite && activity.inviteCode ? `Private invite code: ${activity.inviteCode}` : '',
      activityUrl,
    ].filter(Boolean).join('\n\n');
  };

  const shareActivity = async (mode: 'share' | 'invite') => {
    const title = mode === 'invite' ? `Join me at ${activity.title}` : activity.title;
    const message = getShareMessage(
      mode === 'invite'
        ? 'I found this plan on JOIN — want to come?'
        : 'Check out this plan on JOIN.',
      mode === 'invite' && isHost && activity.visibility === 'private',
    );

    try {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        if (typeof navigator.share === 'function') {
          await navigator.share({ title, text: message });
          return;
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(message);
          Alert.alert('Link copied', mode === 'invite' ? 'Invite copied. Send it to your friend.' : 'Plan details copied.');
          return;
        }
      }

      await Share.share({ title, message });
    } catch (error: any) {
      if (error?.name === 'AbortError') return;
      Alert.alert(
        mode === 'invite' ? 'Could not invite friend' : 'Could not share plan',
        'Please try again in a moment.',
      );
    }
  };

  const openActivityLocation = () => {
    const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.location)}`;
    Linking.openURL(mapsUrl).catch(() => {
      Alert.alert('Could not open maps', 'Please try again in a moment.');
    });
  };

  const refreshActivity = async () => {
    const result = await fetchActivity(activityId, token || undefined, inviteCode);
    setActivity(result);
  };

  const handleApprove = async (participantId?: string) => {
    if (!token || !participantId) return;
    await approveJoinRequest(activity.id, participantId, token);
    await refreshActivity();
  };

  const handleDecline = async (participantId?: string) => {
    if (!token || !participantId) return;
    await declineJoinRequest(activity.id, participantId, token);
    await refreshActivity();
  };

  const handleCancelActivity = async () => {
    if (!token) return;
    Alert.alert('Cancel activity?', 'Participants will no longer be able to join this activity.', [
      { text: 'Keep activity', style: 'cancel' },
      {
        text: 'Cancel activity',
        style: 'destructive',
        onPress: async () => {
          await cancelActivityRequest(activity.id, token, 'Cancelled by host.');
          await refreshActivity();
        },
      },
    ]);
  };

  const toggleMomentLike = async (moment: MomentResponse) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in to like a Moment.');
      return;
    }
    if (busyMomentId) return;
    setBusyMomentId(moment.id);
    try {
      const response = moment.likedByViewer
        ? await unlikeMomentRequest(moment.id, token)
        : await likeMomentRequest(moment.id, token);
      setMoments((current) => current.map((item) => item.id === moment.id
        ? { ...item, likedByViewer: response.data.liked, likeCount: response.data.likeCount }
        : item));
    } catch (error: any) {
      Alert.alert('Like not updated', error?.response?.data?.message || 'Please try again.');
    } finally {
      setBusyMomentId(undefined);
    }
  };

  const updateMomentComments = (
    momentId: string,
    update: Pick<MomentResponse, 'commentCount' | 'latestComments'>,
  ) => {
    setMoments((current) => current.map((moment) => moment.id === momentId ? { ...moment, ...update } : moment));
  };

  const deleteMoment = (moment: MomentResponse) => {
    if (!token) return;
    Alert.alert('Delete Moment?', 'This removes it from the activity and your profile.', [
      { text: 'Keep Moment', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyMomentId(moment.id);
          try {
            await deleteMomentRequest(moment.id, token);
            setMoments((current) => current.filter((item) => item.id !== moment.id));
          } catch (error: any) {
            Alert.alert('Moment not deleted', error?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyMomentId(undefined);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <ImageBackground source={{ uri: coverImage }} style={[styles.heroImage, compact && styles.heroImageCompact]}>
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
            <View style={styles.visibilityBadge}>
              <Text style={styles.visibilityBadgeText}>{activity.visibility === 'private' ? 'Private' : 'Public'}</Text>
            </View>
            {isCancelled ? (
              <View style={styles.cancelledBadge}>
                <Text style={styles.cancelledBadgeText}>Cancelled</Text>
              </View>
            ) : null}
          </View>
          <View>
            <Text style={styles.title} numberOfLines={3}>{activity.title}</Text>
            <View style={styles.heroMetaRow}>
              <Ionicons name="people-outline" size={16} color="#f5c12d" />
              <Text style={styles.heroMeta}>{capacity} participants</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.heroReturnButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.72}
          accessibilityRole="button"
          accessibilityLabel="Back to activity feed"
        >
          <View style={styles.heroReturnButtonVisual}>
            <Ionicons name="chevron-down" size={22} color="#f5c12d" />
          </View>
        </TouchableOpacity>
      </ImageBackground>

      <View style={styles.content}>
        <View style={styles.metadataGrid}>
          <View style={[styles.metadataCard, compact && styles.metadataCardCompact]}>
            <Ionicons name="time-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Time</Text>
            <Text style={styles.metadataValue}>{activity.time || 'Anytime'}</Text>
          </View>
          <TouchableOpacity
            style={[styles.metadataCard, compact && styles.metadataCardCompact]}
            onPress={openActivityLocation}
            activeOpacity={0.78}
          >
            <Ionicons name="location-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Place</Text>
            <Text style={styles.metadataValue} numberOfLines={1}>{activity.location}</Text>
          </TouchableOpacity>
          <View style={[styles.metadataCard, compact && styles.metadataCardCompact]}>
            <Ionicons name="navigate-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Distance</Text>
            <Text style={styles.metadataValue}>{activity.distance || 'Distance unavailable'}</Text>
          </View>
          <View style={[styles.metadataCard, compact && styles.metadataCardCompact]}>
            <Ionicons name="star-outline" size={18} color="#f5c12d" />
            <Text style={styles.metadataLabel}>Vibe</Text>
            <Text style={styles.metadataValue}>{activity.vibe || 'Social'}</Text>
          </View>
        </View>

        <View style={styles.hostCard}>
          <TouchableOpacity style={styles.hostAvatarButton} onPress={() => navigation.navigate('PublicProfile', { userId: activity.hostId, fallbackName: activity.host, fallbackAvatar: activity.hostAvatar })}>
            <AvatarBadge name={activity.host} avatarUrl={activity.hostAvatar} size={46} />
          </TouchableOpacity>
          <View style={styles.hostDetails}>
            <Text style={styles.hostLabel}>Hosted by</Text>
            <Text style={styles.hostName}>{activity.host}</Text>
            <Text style={styles.hostMeta}>
              {hostRating} rating - {activity.hostHostedCount || 0} hosted - {activity.hostJoinedCount || 0} joined
            </Text>
          </View>
          <View style={styles.hostBadge}>
            <Ionicons name="shield-checkmark-outline" size={15} color="#050505" />
            <Text style={styles.hostBadgeText}>{activity.hostVerified ? 'Verified host' : 'Profile reviewed'}</Text>
          </View>
        </View>

        <View style={styles.positioningCard}>
          <Text style={styles.positioningTitle}>See who's going before you join</Text>
          <Text style={styles.positioningText}>JOIN is built for small-group social plans with trusted hosts and real people around the table, trail, class, or beach.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          {activity.ageGroup && activity.ageGroup !== 'any' ? (
            <View style={styles.ageGroupTag}>
              <Ionicons name="people-outline" size={14} color="#f5c12d" />
              <Text style={styles.ageGroupTagText}>Intended age group {activity.ageGroup.replace('-', '–')}</Text>
            </View>
          ) : null}
          <Text style={styles.descriptionText}>{activity.description}</Text>
          {isCancelled && activity.cancellationReason ? <Text style={styles.cancelReason}>{activity.cancellationReason}</Text> : null}
        </View>

        {activity.galleryImages?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Gallery</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {activity.galleryImages.slice(0, 5).map((image) => (
                <Image key={image} source={{ uri: image }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {(hasActivityStarted || moments.length > 0) ? (
          <View style={styles.section}>
            <View style={styles.momentSectionHeader}>
              <View style={styles.momentSectionCopy}>
                <Text style={styles.momentEyebrow}>REAL EXPERIENCES</Text>
                <Text style={styles.sectionTitle}>Moments from this activity</Text>
              </View>
              {canCreateMoment ? (
                <TouchableOpacity style={styles.addMomentButton} onPress={() => setCreateMomentVisible(true)}>
                  <Ionicons name="add" size={17} color="#050505" />
                  <Text style={styles.addMomentText}>Add Moment</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {momentsLoading ? <ActivityIndicator color="#f5c12d" style={styles.momentLoader} /> : null}
            {momentError ? <Text style={styles.momentError}>{momentError}</Text> : null}
            {!momentsLoading && !moments.length ? <Text style={styles.momentEmpty}>No Moments yet</Text> : null}
            {moments.map((moment) => (
              <React.Fragment key={moment.id}>
                <MomentCard
                  moment={moment}
                  busy={busyMomentId === moment.id}
                  onCreatorPress={(creatorId) => navigation.navigate('PublicProfile', { userId: creatorId })}
                  onToggleLike={toggleMomentLike}
                  onCommentsPress={(selectedMoment) => setCommentMomentId((current) => current === selectedMoment.id ? undefined : selectedMoment.id)}
                  onDelete={deleteMoment}
                />
                {commentMomentId === moment.id ? (
                  <MomentCommentsSection
                    moment={moment}
                    token={token}
                    onMomentUpdate={updateMomentComments}
                    onAuthorPress={(creatorId) => navigation.navigate('PublicProfile', { userId: creatorId })}
                  />
                ) : null}
              </React.Fragment>
            ))}
          </View>
        ) : null}

        {isHost && activity.pendingParticipants?.length ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending requests</Text>
            {activity.pendingParticipants.map((participant) => (
              <View key={participant.id || participant.name} style={styles.pendingRow}>
                <AvatarBadge name={participant.name} avatarUrl={participant.profileThumbnailUrl || participant.profilePictureUrl || participant.avatar} size={34} />
                <Text style={styles.pendingName}>{participant.name}</Text>
                <TouchableOpacity style={styles.approveButton} onPress={() => handleApprove(participant.id)}>
                  <Text style={styles.approveText}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.declineButton} onPress={() => handleDecline(participant.id)}>
                  <Text style={styles.declineText}>Decline</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : null}

        {isHost && !isCancelled ? (
          <TouchableOpacity style={styles.cancelButton} onPress={handleCancelActivity}>
            <Text style={styles.cancelButtonText}>Cancel activity</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Participants</Text>
          <View style={styles.participantsRow}>
            {activity.participants.slice(0, 5).map((participant, index) => (
              <TouchableOpacity
                key={`${participant.name}-${index}`}
                style={[styles.participantAvatar, { marginLeft: index === 0 ? 0 : -10 }]}
                onPress={() => navigation.navigate('PublicProfile', {
                  userId: participant.id,
                  fallbackName: participant.name,
                  fallbackAvatar: participant.avatar || participant.profileThumbnailUrl || participant.profilePictureUrl,
                })}
              >
                <AvatarBadge
                  name={participant.name}
                  avatarUrl={participant.profileThumbnailUrl || participant.profilePictureUrl || participant.avatar}
                  size={42}
                />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.participantCount} onPress={() => setParticipantsVisible(true)}>
              <Text style={styles.participantCountText}>{capacity}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.viewAllButton} onPress={() => setParticipantsVisible(true)}>
            <Text style={styles.viewAllText}>View all participants</Text>
          </TouchableOpacity>
        </View>

        {canOpenChat ? <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Discussion</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}>
              <Text style={styles.sectionAction}>Open chat</Text>
            </TouchableOpacity>
          </View>
        </View> : null}

        <View style={styles.shareActions}>
          <TouchableOpacity style={styles.shareButton} onPress={() => shareActivity('share')} activeOpacity={0.82}>
            <Ionicons name="share-outline" size={16} color="#f5c12d" />
            <Text style={styles.shareButtonText}>Share plan</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={() => shareActivity('invite')} activeOpacity={0.82}>
            <Ionicons name="person-add-outline" size={16} color="#f5c12d" />
            <Text style={styles.shareButtonText}>Invite a friend</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.joinButton, (alreadyJoined || pendingApproval || requestDeclined || waitlisted || isCancelled || isPastOrCompleted) && styles.joinedButton]} onPress={handleJoin} disabled={alreadyJoined || pendingApproval || requestDeclined || waitlisted || isCancelled || isPastOrCompleted}>
            <Ionicons name={alreadyJoined ? 'checkmark-circle-outline' : 'add-circle-outline'} size={18} color={alreadyJoined ? '#888888' : '#050505'} />
            <Text style={[styles.joinButtonText, alreadyJoined && styles.joinedButtonText]}>
              {joinLabel}
            </Text>
          </TouchableOpacity>

          {canOpenChat ? <TouchableOpacity style={styles.chatButton} onPress={() => navigation.navigate('Chat', { chatId: activity.id, title: activity.title })}>
            <Ionicons name="chatbubbles-outline" size={18} color="#f5c12d" />
          </TouchableOpacity> : null}
        </View>
      </View>

      <ParticipantsModal
        visible={participantsVisible}
        participants={activity.participants}
        onClose={() => setParticipantsVisible(false)}
        onOpenProfile={(participant) => {
          setParticipantsVisible(false);
          navigation.navigate('PublicProfile', {
            userId: participant.id,
            fallbackName: participant.name,
            fallbackAvatar: participant.avatar || participant.profileThumbnailUrl || participant.profilePictureUrl,
          });
        }}
      />

      {token ? (
        <CreateMomentModal
          visible={createMomentVisible}
          activityId={activity.id}
          activityTitle={activity.title}
          token={token}
          onClose={() => setCreateMomentVisible(false)}
          onCreated={(moment) => setMoments((current) => [moment, ...current])}
        />
      ) : null}

      <Modal
        visible={photoRequiredVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setPhotoRequiredVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.photoRequiredModal}>
            <View style={styles.photoRequiredIcon}>
              <Ionicons name="camera-outline" size={24} color="#050505" />
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
    maxWidth: 520,
    alignSelf: 'center',
    height: 290,
  },
  heroImageCompact: {
    height: 240,
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
  heroReturnButton: {
    position: 'absolute',
    left: '50%',
    bottom: -22,
    width: 44,
    height: 44,
    marginLeft: -22,
    zIndex: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroReturnButtonVisual: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,14,12,0.96)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.48)',
    shadowColor: '#f5c12d',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  heroBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
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
  visibilityBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245, 193, 45, 0.35)',
  },
  visibilityBadgeText: {
    color: '#f5c12d',
    fontSize: 12,
    fontWeight: '900',
  },
  cancelledBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
  },
  cancelledBadgeText: {
    color: '#ffffff',
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
    width: '100%',
    maxWidth: 520,
    alignSelf: 'center',
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
  metadataCardCompact: {
    width: '100%',
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
  hostAvatarButton: {
    marginRight: 11,
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
  hostMeta: {
    color: '#8b8b8b',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 3,
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
  positioningCard: {
    backgroundColor: 'rgba(245, 193, 45, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 193, 45, 0.28)',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  positioningTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
    marginBottom: 5,
  },
  positioningText: {
    color: '#d1d1d1',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
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
  ageGroupTag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(245,193,45,0.35)',
    backgroundColor: 'rgba(245,193,45,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  ageGroupTagText: {
    color: '#b7b0a2',
    fontSize: 11,
    fontWeight: '800',
  },
  descriptionText: {
    color: '#d1d1d1',
    fontSize: 14,
    lineHeight: 21,
  },
  cancelReason: {
    color: '#fca5a5',
    marginTop: 8,
    fontWeight: '800',
  },
  galleryImage: {
    width: 120,
    height: 88,
    borderRadius: 8,
    marginRight: 10,
    backgroundColor: '#111111',
  },
  momentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  momentSectionCopy: {
    flex: 1,
  },
  momentEyebrow: {
    color: '#f5c12d',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
    marginBottom: 3,
  },
  addMomentButton: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 19,
    paddingHorizontal: 12,
    backgroundColor: '#f5c12d',
  },
  addMomentText: {
    color: '#050505',
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 4,
  },
  momentLoader: {
    marginVertical: 18,
  },
  momentEmpty: {
    color: '#888888',
    fontSize: 13,
    fontWeight: '700',
    paddingVertical: 14,
  },
  momentError: {
    color: '#f5c12d',
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 10,
  },
  pendingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  pendingName: {
    flex: 1,
    color: '#ffffff',
    fontWeight: '900',
    marginLeft: 9,
  },
  approveButton: {
    backgroundColor: '#f5c12d',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 6,
  },
  approveText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '900',
  },
  declineButton: {
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 6,
  },
  declineText: {
    color: '#B3B3B3',
    fontSize: 12,
    fontWeight: '900',
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: '#EF4444',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  cancelButtonText: {
    color: '#EF4444',
    fontWeight: '900',
  },
  participantsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  participantAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
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
  viewAllButton: {
    alignSelf: 'flex-start',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  viewAllText: {
    color: '#f5c12d',
    fontSize: 12,
    fontWeight: '900',
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
  shareActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  shareButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#3A3A3A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  shareButtonText: {
    color: '#f5c12d',
    fontSize: 13,
    fontWeight: '900',
    marginLeft: 6,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    padding: 24,
  },
  photoRequiredModal: {
    backgroundColor: '#1E1E1E',
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(244, 197, 66, 0.28)',
  },
  photoRequiredIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#f5c12d',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  photoRequiredText: {
    color: '#B3B3B3',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '700',
    marginBottom: 24,
  },
  photoRequiredPrimary: {
    backgroundColor: '#f5c12d',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoRequiredPrimaryText: {
    color: '#050505',
    fontWeight: '900',
  },
  photoRequiredSecondary: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoRequiredSecondaryText: {
    color: '#B3B3B3',
    fontWeight: '800',
  },
});
