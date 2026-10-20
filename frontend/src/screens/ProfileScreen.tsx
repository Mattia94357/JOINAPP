import React, { useContext, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Modal,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  deleteMomentRequest,
  fetchOwnActivityHistoryRequest,
  fetchUserMomentsRequest,
  likeMomentRequest,
  MomentResponse,
  ProfileActivity,
  unlikeMomentRequest,
  updateProfilePhotoRequest,
  updateProfileRequest,
} from '../api';
import AvatarBadge from '../components/AvatarBadge';
import ProfileDetailsEditor from '../components/ProfileDetailsEditor';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';
import { choosePhotoSource, pickProfileImage, PhotoSource } from '../utils/mediaPermissions';
import BottomNavigation, {
  BOTTOM_NAV_WEB_CONTENT_CLEARANCE,
  getBottomNavigationClearance,
} from '../components/BottomNavigation';
import ProfileHistoryTabs from '../components/ProfileHistoryTabs';
import LatestMomentSection from '../components/LatestMomentSection';
import ProfileMomentsModal from '../components/ProfileMomentsModal';
import { locationFailureMessage } from '../utils/currentRegion';
import { getCurrentJoinPlaceResult } from '../utils/locationService';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const maxProfileImageBytes = 4 * 1024 * 1024;
const supportedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
] as const;

const getMimeTypeFromAsset = (asset: ImagePicker.ImagePickerAsset) => {
  const mimeType = (asset as ImagePicker.ImagePickerAsset & { mimeType?: string }).mimeType;
  if (mimeType) return mimeType.toLowerCase();

  const extension = asset.uri.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  return '';
};

const getBase64ByteSize = (value: string) => Math.ceil((value.length * 3) / 4);
const debugPhotoUpload = (event: string, details?: Record<string, unknown>) => {
  if (__DEV__) console.info(`[JOIN photo] ${event}`, details || {});
};

export default function ProfileScreen({ navigation }: Props) {
  const { user, token, updateUser } = useAuth();
  const { width } = useWindowDimensions();
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const bottomNavigationClearance = Platform.OS === 'web'
    ? BOTTOM_NAV_WEB_CONTENT_CLEARANCE
    : getBottomNavigationClearance(safeAreaInsets?.bottom ?? 0);
  const compact = width < 390;
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [passportVisible, setPassportVisible] = useState(false);
  const [locationAttempt, setLocationAttempt] = useState(0);
  const [locationError, setLocationError] = useState('');
  const [deviceLocation, setDeviceLocation] = useState('Finding current location…');
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || user?.bio || '');
  const [languagesText, setLanguagesText] = useState((user?.languages || []).join(', '));
  const [interestsText, setInterestsText] = useState((user?.interests || []).join(', '));
  const [instagram, setInstagram] = useState(user?.instagram || '');
  const [ageRange, setAgeRange] = useState(user?.ageRange || '');
  const [gender, setGender] = useState(user?.gender || 'prefer_not_to_say');
  const [hostedActivities, setHostedActivities] = useState<ProfileActivity[]>([]);
  const [joinedActivities, setJoinedActivities] = useState<ProfileActivity[]>([]);
  const [moments, setMoments] = useState<MomentResponse[]>([]);
  const [momentTotal, setMomentTotal] = useState(0);
  const [momentsVisible, setMomentsVisible] = useState(false);
  const [commentMomentId, setCommentMomentId] = useState<string>();
  const [historyLoading, setHistoryLoading] = useState(true);
  const [hostedCount, setHostedCount] = useState(user?.hostedCount || 0);
  const [joinedCount, setJoinedCount] = useState(user?.joinedCount || 0);
  const [historyError, setHistoryError] = useState('');
  const [busyMomentId, setBusyMomentId] = useState<string>();

  const interests = user?.interests || [];
  const location = deviceLocation;
  const hasProfilePhoto = Boolean(user?.profilePictureUrl || user?.profileThumbnailUrl);
  const profileImage = user?.profileThumbnailUrl || user?.profilePictureUrl;
  const displayHostedCount = hostedCount;
  const displayJoinedCount = joinedCount;

  const latestMoment = useMemo(() => [...moments].sort((a, b) => (
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  ))[0], [moments]);

  const resetProfileDrafts = () => {
    setAboutMe(user?.aboutMe || user?.bio || '');
    setLanguagesText((user?.languages || []).join(', '));
    setInterestsText((user?.interests || []).join(', '));
    setInstagram(user?.instagram || '');
    setAgeRange(user?.ageRange || '');
    setGender(user?.gender || 'prefer_not_to_say');
  };

  useEffect(() => {
    resetProfileDrafts();
  }, [user?.id]);

  useEffect(() => {
    let active = true;
    setDeviceLocation('Finding current location...');
    void getCurrentJoinPlaceResult({ token: token || undefined, retryDenied: true, forceRefresh: locationAttempt > 0 }).then(async (result) => {
      if (!active) return;
      if (result.status !== 'success' || !result.place) {
        setDeviceLocation(result.status === 'failure' ? 'Current location unavailable' : 'Current area found');
        setLocationError(result.status === 'failure' ? locationFailureMessage(result.reason) : result.placeError || 'Location found; the place label is temporarily unavailable. Retry shortly.');
        return;
      }
      setDeviceLocation(result.place);
      setLocationError('');
      if (token && result.place !== user?.location) {
        try {
          if (active && user) await updateUser({ ...user, location: result.place });
        } catch {
          // A reverse-geocoded label is helpful but must never block Profile.
        }
      }
    });
    return () => { active = false; };
  }, [token, user?.id, locationAttempt]);

  useEffect(() => {
    let active = true;
    const loadHistory = async () => {
      if (!token || !user?.id) {
        if (active) setHistoryLoading(false);
        return;
      }
      setHistoryLoading(true);
      setHistoryError('');
      try {
        const [historyResult, momentResult] = await Promise.allSettled([
          fetchOwnActivityHistoryRequest(token),
          fetchUserMomentsRequest(user.id, token),
        ]);
        if (!active) return;
        if (historyResult.status === 'fulfilled') {
          setHostedActivities(historyResult.value.data.hostedActivities || []);
          setJoinedActivities(historyResult.value.data.joinedActivities || []);
          setHostedCount(historyResult.value.data.hostedCount ?? historyResult.value.data.hostedActivities.length);
          setJoinedCount(historyResult.value.data.joinedCount ?? historyResult.value.data.joinedActivities.length);
        } else {
          setHistoryError('Activity history is temporarily unavailable.');
        }
        if (momentResult.status === 'fulfilled') {
          setMoments(momentResult.value.data.moments || []);
          setMomentTotal(momentResult.value.data.total || 0);
        } else {
          setMoments([]);
          setMomentTotal(0);
        }
      } catch {
        if (active) setHistoryError('Activity history is temporarily unavailable.');
      } finally {
        if (active) setHistoryLoading(false);
      }
    };
    loadHistory();
    return () => { active = false; };
  }, [token, user?.id]);

  const toggleMomentLike = async (moment: MomentResponse) => {
    if (!token || busyMomentId) return;
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
    Alert.alert('Delete Moment?', 'This removes it from your profile and the activity.', [
      { text: 'Keep Moment', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyMomentId(moment.id);
          try {
            await deleteMomentRequest(moment.id, token);
            setMoments((current) => current.filter((item) => item.id !== moment.id));
            setMomentTotal((current) => Math.max(current - 1, 0));
          } catch (error: any) {
            Alert.alert('Moment not deleted', error?.response?.data?.message || 'Please try again.');
          } finally {
            setBusyMomentId(undefined);
          }
        },
      },
    ]);
  };

  const uploadSelectedPhoto = async (source: PhotoSource) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in before updating your profile photo.');
      return;
    }

    setUploading(true);
    setUploadMessage('');

    try {
      const asset = await pickProfileImage(source);
      if (!asset) {
        debugPhotoUpload('image selection ended without asset', { source });
        return;
      }

      const mimeType = getMimeTypeFromAsset(asset);
      const payloadBytes = asset.base64 ? getBase64ByteSize(asset.base64) : 0;
      debugPhotoUpload('profile screen received image', {
        source,
        mimeType,
        width: asset.width,
        height: asset.height,
        payloadBytes,
      });

      if (!supportedMimeTypes.includes(mimeType)) {
        setUploadMessage('Use a JPEG, PNG, or WEBP profile photo.');
        Alert.alert('Unsupported image', 'Use a JPEG, PNG, or WEBP profile photo.');
        return;
      }

      if (asset.fileSize && asset.fileSize > maxProfileImageBytes) {
        setUploadMessage('Profile photos must be 4MB or smaller.');
        Alert.alert('Image too large', 'Profile photos must be 4MB or smaller.');
        return;
      }

      if (!asset.base64) {
        setUploadMessage('Could not read this image. Please try another photo.');
        Alert.alert('Photo unavailable', 'Could not read this image. Please try another photo.');
        return;
      }

      if (payloadBytes > maxProfileImageBytes) {
        setUploadMessage('Profile photos must be 4MB or smaller.');
        Alert.alert('Image too large', 'Profile photos must be 4MB or smaller.');
        return;
      }

      const imageDataUrl = `data:${mimeType};base64,${asset.base64}`;
      debugPhotoUpload('endpoint called', { endpoint: '/api/users/me/profile-photo', payloadBytes });
      const response = await updateProfilePhotoRequest(imageDataUrl, token);
      debugPhotoUpload('response received', {
        status: response.status,
        hasProfilePictureUrl: Boolean(response.data.profilePictureUrl),
      });
      await updateUser(response.data);
      debugPhotoUpload('AuthContext updated', {
        hasProfilePictureUrl: Boolean(response.data.profilePictureUrl),
        hasProfileThumbnailUrl: Boolean(response.data.profileThumbnailUrl),
      });
      setUploadMessage('Profile photo updated. It will now appear across JOIN.');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Unable to upload profile photo right now.';
      debugPhotoUpload('upload response failure', {
        status: error?.response?.status,
        message,
      });
      setUploadMessage(message);
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  };

  const handlePickPhoto = async () => {
    if (uploading) return;
    choosePhotoSource(uploadSelectedPhoto);
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    setSavingProfile(true);
    try {
      const response = await updateProfileRequest(
        {
          aboutMe: aboutMe.trim(),
          bio: aboutMe.trim(),
          languages: languagesText.split(',').map((item) => item.trim()).filter(Boolean),
          interests: interestsText.split(',').map((item) => item.trim()).filter(Boolean),
          instagram: instagram.trim(),
          ageRange: ageRange.trim(),
          gender,
        },
        token,
      );
      await updateUser(response.data);
      setUploadMessage('Profile updated.');
      setEditingProfile(false);
    } catch (error: any) {
      Alert.alert('Unable to save profile', error?.response?.data?.message || 'Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.container,
          { paddingBottom: bottomNavigationClearance },
        ]}
      >
      <View style={[styles.header, compact && styles.headerCompact]}>
        <View style={[styles.photoColumn, compact && styles.photoColumnCompact]}>
          <View style={styles.profileImageFrame}>
            <AvatarBadge name={user?.name || 'Guest'} avatarUrl={profileImage} size={104} />
          </View>
          <TouchableOpacity
            style={[styles.photoButton, uploading && styles.photoButtonDisabled]}
            onPress={handlePickPhoto}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={colors.primaryText} size="small" />
            ) : (
              <>
                <Ionicons name="camera-outline" size={17} color={colors.primaryText} />
                <Text style={styles.photoButtonText}>{hasProfilePhoto ? 'Change photo' : 'Upload profile photo'}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={[styles.profileCopy, compact && styles.profileCopyCompact]}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user?.name || 'Guest'}</Text>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.location}>{location}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry current location" onPress={() => setLocationAttempt(n => n + 1)}><Ionicons name="refresh" size={16} color={colors.primary} /></TouchableOpacity>
          </View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Change location" hitSlop={10} onPress={() => setPassportVisible(true)}>
            <Text style={[styles.changeLocationText, { marginLeft: 0, marginTop: 8 }]}>Change location</Text>
          </TouchableOpacity>
          <Text style={styles.bio} numberOfLines={3}>
            {user?.aboutMe || user?.bio || 'Add a short bio so people know who they are meeting.'}
          </Text>
          {!editingProfile ? (
            <TouchableOpacity style={styles.editProfileButton} accessibilityRole="button" accessibilityLabel="Edit profile" hitSlop={8} onPress={() => setEditingProfile(true)}>
              <Text style={styles.editProfileText}>Edit profile</Text>
            </TouchableOpacity>
          ) : null}
          <View style={[styles.completionPill, hasProfilePhoto ? styles.completionPillReady : styles.completionPillNeeded]}>
            <Ionicons
              name={hasProfilePhoto ? 'checkmark-circle-outline' : 'alert-circle-outline'}
              size={15}
              color={hasProfilePhoto ? colors.success : colors.warning}
            />
            <Text style={styles.completionText}>
              {hasProfilePhoto ? 'Ready to join activities' : 'Photo required before joining'}
            </Text>
          </View>
        </View>
      </View>

      {uploadMessage ? <Text style={styles.uploadMessage}>{uploadMessage}</Text> : null}

      {locationError ? <Text style={styles.emptyText} accessibilityLiveRegion="polite">{locationError}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{displayHostedCount}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{displayJoinedCount}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
      </View>

      <LatestMomentSection
        moment={latestMoment}
        total={momentTotal}
        loading={historyLoading}
        ownProfile
        compact
        busy={busyMomentId === latestMoment?.id}
        onActivityPress={(activityId) => navigation.navigate('Activity', { activityId })}
        onToggleLike={toggleMomentLike}
        onCommentsPress={(moment) => {
          setCommentMomentId(moment.id);
          setMomentsVisible(true);
        }}
        onViewAll={() => {
          setCommentMomentId(undefined);
          setMomentsVisible(true);
        }}
      />

      {historyError ? <Text style={styles.historyError}>{historyError}</Text> : null}
      <ProfileHistoryTabs
        joined={joinedActivities}
        hosted={hostedActivities}
        joinedCount={joinedCount}
        hostedCount={hostedCount}
        loading={historyLoading}
        onActivityPress={(activityId) => navigation.navigate('Activity', { activityId })}
      />

      <View style={[styles.section, styles.profileDetailsSurface]}>
        <View style={styles.profileDetailsHeader}>
          <View>
            <Text style={styles.profileDetailsTitle}>Profile details</Text>
          </View>

        </View>

        <View style={[styles.profileDetailsBody, editingProfile && styles.profileDetailsEditBody]}>
          {editingProfile ? (
            <ProfileDetailsEditor aboutMe={aboutMe} onAboutMeChange={setAboutMe}
              languagesText={languagesText} onLanguagesChange={setLanguagesText}
              interestsText={interestsText} onInterestsChange={setInterestsText}
              instagram={instagram} onInstagramChange={setInstagram} ageRange={ageRange} onAgeRangeChange={setAgeRange}
              gender={gender} onGenderChange={setGender} genderOptions={genderOptions} saving={savingProfile}
              onSave={handleSaveProfile} onCancel={() => { resetProfileDrafts(); setEditingProfile(false); }} />
          ) : (
            <>
              <View style={styles.detailPair}>
                <View style={styles.detailGrow}><Text style={styles.detailLabel}>LANGUAGES</Text><Text style={styles.detailValue}>{user?.languages?.join(', ') || 'Not added'}</Text></View>
                <View style={styles.detailGrow}><Text style={styles.detailLabel}>AGE RANGE</Text><Text style={styles.detailValue}>{user?.ageRange || 'Not added'}</Text></View>
              </View>
              {user?.instagram ? <><Text style={styles.detailLabel}>INSTAGRAM</Text>
              <Text style={styles.detailValue}>{user.instagram}</Text></> : null}
            </>
          )}
        </View>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.interestTags}>
          {interests.length ? interests.map((interest) => (
            <View key={interest} style={styles.interestTag}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          )) : <Text style={styles.emptyText}>Add interests to help people understand your vibe.</Text>}
        </View>

      <View style={styles.activityColumns}>
        <View style={styles.activityColumn}>
          <Text style={styles.sectionTitle}>Saved Activities</Text>
          <View style={styles.activityRow}>
            <Ionicons name="bookmark-outline" size={16} color={colors.primary} />
            <View style={styles.activityTextBlock}>
              <Text style={styles.activityTitle}>{user?.savedActivities?.length || 0} saved plans</Text>
              <Text style={styles.activityMeta}>{user?.savedActivities?.length ? 'Return to Home to keep browsing your saved activities.' : 'No saved activities yet. Use the bookmark button on activity cards.'}</Text>
            </View>
          </View>
        </View>

      </View>

      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primaryText} />
          <Text style={styles.actionButtonText}>Host a plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryActionText}>Notifications</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.settingsButton} onPress={() => navigation.navigate('Settings')}>
        <Ionicons name="settings-outline" size={18} color={colors.text} />
        <Text style={styles.settingsText}>Settings</Text>
        <Ionicons name="chevron-forward-outline" size={18} color={colors.textSubtle} />
      </TouchableOpacity>
      </ScrollView>
      <ProfileMomentsModal
        visible={momentsVisible}
        moments={moments}
        total={momentTotal}
        busyMomentId={busyMomentId}
        token={token}
        initialCommentMomentId={commentMomentId}
        onClose={() => {
          setMomentsVisible(false);
          setCommentMomentId(undefined);
        }}
        onActivityPress={(activityId) => navigation.navigate('Activity', { activityId })}
        onCreatorPress={(creatorId) => {
          if (creatorId !== user?.id) {
            setMomentsVisible(false);
            navigation.push('PublicProfile', { userId: creatorId });
          }
        }}
        onToggleLike={toggleMomentLike}
        onDeleteMoment={deleteMoment}
        onMomentUpdate={updateMomentComments}
      />
      <Modal visible={passportVisible} transparent animationType="fade" onRequestClose={() => setPassportVisible(false)}>
        <View style={styles.passportBackdrop}>
          <View style={styles.passportCard}>
            <Text style={styles.passportEyebrow}>JOIN+</Text>
            <Text style={styles.passportTitle}>Passport Mode</Text>
            <Text style={styles.passportCopy}>Explore and plan in another city while your current location stays device-derived. Passport Mode will require an upgrade and is not available yet.</Text>
            <TouchableOpacity style={styles.passportButton} onPress={() => setPassportVisible(false)}>
              <Text style={styles.passportButtonText}>Got it</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <BottomNavigation />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  headerCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  photoColumn: {
    width: 112,
  },
  photoColumnCompact: {
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileImageFrame: {
    width: 104,
    height: 104,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surface,
  },
  photoButton: {
    minHeight: 36,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
  },
  photoButtonDisabled: {
    opacity: 0.72,
  },
  photoButtonText: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: 5,
    textAlign: 'center',
  },
  profileCopy: {
    flex: 1,
    marginLeft: spacing.md,
  },
  profileCopyCompact: {
    width: '100%',
    marginLeft: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
    flexShrink: 1,
  },
  verifiedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  location: {
    color: colors.textMuted,
    fontSize: 13,
    marginLeft: 5,
    flexShrink: 1,
  },
  bio: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  completionPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: spacing.sm,
  },
  completionPillReady: {
    backgroundColor: 'rgba(34,197,94,0.1)',
    borderColor: 'rgba(34,197,94,0.3)',
  },
  completionPillNeeded: {
    backgroundColor: 'rgba(245,158,11,0.1)',
    borderColor: 'rgba(245,158,11,0.28)',
  },
  completionText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    marginLeft: 5,
  },
  uploadMessage: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  historyError: {
    color: colors.warning,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: spacing.md,
  },
  trustCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.goldWash,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 12,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  trustText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: spacing.sm,
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.md,
    paddingVertical: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: colors.primary,
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginTop: spacing.md,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 9,
  },
  profileDetailsHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  profileDetailsEyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.6 },
  profileDetailsTitle: { color: colors.text, fontSize: 24, fontWeight: '900', marginTop: 3 },
  editProfileButton: { alignSelf: 'flex-start', marginTop: 12, borderWidth: 1, borderColor: colors.goldBorder, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  editProfileText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  profileDetailsEditBody: { backgroundColor: 'transparent', padding: 0, paddingTop: 8 },
  profileDetailsSurface: { backgroundColor: colors.surfaceSoft, borderRadius: 18, padding: spacing.lg, marginTop: spacing.lg },
  profileDetailsBody: { paddingBottom: spacing.lg },
  detailLocationRow: { flexDirection: 'row', alignItems: 'center' },
  detailGrow: { flex: 1 },
  detailLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, marginTop: spacing.sm, marginBottom: 4 },
  detailValue: { color: colors.text, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  changeLocationText: { color: colors.primary, fontSize: 12, fontWeight: '900', marginLeft: spacing.md },
  detailDivider: { height: 1, backgroundColor: colors.border, marginTop: spacing.md },
  detailPair: { flexDirection: 'row', gap: spacing.md },
  passportBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'center', padding: spacing.lg },
  passportCard: { backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.goldBorder, borderRadius: 20, padding: spacing.xl },
  passportEyebrow: { color: colors.primary, fontWeight: '900', letterSpacing: 2, fontSize: 11 },
  passportTitle: { color: colors.text, fontSize: 28, fontWeight: '900', marginTop: 6 },
  passportCopy: { color: colors.textMuted, lineHeight: 22, marginTop: spacing.md },
  passportButton: { backgroundColor: colors.primary, borderRadius: 10, alignItems: 'center', paddingVertical: 14, marginTop: spacing.lg },
  passportButtonText: { color: colors.primaryText, fontWeight: '900' },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSoft,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  badgeText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  interestTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  interestText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  activityColumns: {
    marginTop: 14,
  },
  activityColumn: {
    marginBottom: 12,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: spacing.sm,
  },
  activityTextBlock: {
    flex: 1,
    marginLeft: 9,
  },
  activityTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  activityMeta: {
    color: colors.textSubtle,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: colors.textSubtle,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  actionButton: {
    flex: 1.4,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 10,
  },
  actionButtonText: {
    color: colors.primaryText,
    fontWeight: '900',
    marginLeft: 6,
  },
  secondaryAction: {
    flex: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryActionText: {
    color: colors.primary,
    fontWeight: '800',
    marginLeft: 6,
  },
  settingsButton: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  settingsText: {
    flex: 1,
    color: colors.text,
    fontWeight: '900',
    marginLeft: spacing.sm,
  },
});
