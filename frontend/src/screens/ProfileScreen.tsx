import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { deleteAccountRequest, updateProfilePhotoRequest, updateProfileRequest } from '../api';
import AvatarBadge from '../components/AvatarBadge';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';
import { choosePhotoSource, pickProfileImage, PhotoSource } from '../utils/mediaPermissions';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const maxProfileImageBytes = 5 * 1024 * 1024;
const supportedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const genderOptions = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
] as const;

const hosted = [
  { title: 'Rooftop dinner circle', meta: 'Food - 10 guests' },
  { title: 'Founders coffee walk', meta: 'Networking - 8 guests' },
  { title: 'Reset yoga session', meta: 'Wellness - 12 guests' },
];

const joined = [
  { title: 'Gallery opening night', meta: 'Tonight - 1.4 km' },
  { title: 'Trail hike + brunch', meta: 'This weekend - 2.4 km' },
];

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

export default function ProfileScreen({ navigation }: Props) {
  const { user, token, updateUser, logout } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [aboutMe, setAboutMe] = useState(user?.aboutMe || user?.bio || '');
  const [profileLocation, setProfileLocation] = useState(user?.location || '');
  const [languagesText, setLanguagesText] = useState((user?.languages || []).join(', '));
  const [interestsText, setInterestsText] = useState((user?.interests || []).join(', '));
  const [instagram, setInstagram] = useState(user?.instagram || '');
  const [ageRange, setAgeRange] = useState(user?.ageRange || '');
  const [gender, setGender] = useState(user?.gender || 'prefer_not_to_say');
  const [publicGender, setPublicGender] = useState(Boolean(user?.publicGender));

  const interests = user?.interests?.length ? user.interests : ['Wellness', 'Food', 'Networking', 'Culture'];
  const location = user?.location || 'Perth, Australia';
  const hasProfilePhoto = Boolean(user?.profilePictureUrl || user?.profileThumbnailUrl);
  const profileImage = user?.profileThumbnailUrl || user?.profilePictureUrl;
  const displayHostedCount = user?.hostedCount ?? hosted.length;
  const displayJoinedCount = user?.joinedCount ?? joined.length;
  const displayRating = user?.hostRating?.toFixed(1) || '4.8';

  const badges = useMemo(
    () => [
      { icon: 'shield-checkmark-outline', label: user?.verified ? 'Identity verified' : 'Profile reviewed' },
      { icon: 'star-outline', label: hasProfilePhoto ? 'Photo verified' : 'Photo required' },
      { icon: 'people-outline', label: 'Community active' },
    ],
    [hasProfilePhoto, user?.verified],
  );

  const uploadSelectedPhoto = async (source: PhotoSource) => {
    if (!token) {
      Alert.alert('Sign in required', 'Please log in before updating your profile photo.');
      return;
    }

    const asset = await pickProfileImage(source);
    if (!asset) return;
    const mimeType = getMimeTypeFromAsset(asset);

    if (!supportedMimeTypes.includes(mimeType)) {
      setUploadMessage('Use a JPEG, PNG, or WEBP profile photo.');
      Alert.alert('Unsupported image', 'Use a JPEG, PNG, or WEBP profile photo.');
      return;
    }

    if (asset.fileSize && asset.fileSize > maxProfileImageBytes) {
      setUploadMessage('Profile photos must be 5MB or smaller.');
      Alert.alert('Image too large', 'Profile photos must be 5MB or smaller.');
      return;
    }

    if (!asset.base64) {
      setUploadMessage('Could not read this image. Please try another photo.');
      Alert.alert('Photo unavailable', 'Could not read this image. Please try another photo.');
      return;
    }

    if (getBase64ByteSize(asset.base64) > maxProfileImageBytes) {
      setUploadMessage('Profile photos must be 5MB or smaller.');
      Alert.alert('Image too large', 'Profile photos must be 5MB or smaller.');
      return;
    }

    setUploading(true);
    setUploadMessage('');

    try {
      const imageDataUrl = `data:${mimeType};base64,${asset.base64}`;
      const response = await updateProfilePhotoRequest(imageDataUrl, token, imageDataUrl);
      await updateUser(response.data);
      setUploadMessage('Profile photo updated. It will now appear across JOIN.');
    } catch (error: any) {
      const message = error?.response?.data?.message || 'Unable to upload profile photo right now.';
      setUploadMessage(message);
      Alert.alert('Upload failed', message);
    } finally {
      setUploading(false);
    }
  };

  const handlePickPhoto = async () => {
    choosePhotoSource(uploadSelectedPhoto);
  };

  const openPolicyLink = (path: string) => {
    const legalBaseUrl = (Constants.expoConfig?.extra as any)?.LEGAL_BASE_URL || 'https://joinapp.app';
    Linking.openURL(`${legalBaseUrl.replace(/\/$/, '')}/${path}`).catch(() => {
      Alert.alert('Link unavailable', 'This link could not be opened right now.');
    });
  };

  const handleDeleteAccount = () => {
    if (!token) return;

    Alert.alert(
      'Delete account?',
      'This permanently removes your JOIN account. Existing activities may still show historical attendance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAccountRequest(token);
              await logout();
            } catch (error: any) {
              Alert.alert('Unable to delete account', error?.response?.data?.message || 'Please try again later.');
            }
          },
        },
      ],
    );
  };

  const handleSaveProfile = async () => {
    if (!token) return;
    setSavingProfile(true);
    try {
      const response = await updateProfileRequest(
        {
          aboutMe: aboutMe.trim(),
          bio: aboutMe.trim(),
          location: profileLocation.trim(),
          languages: languagesText.split(',').map((item) => item.trim()).filter(Boolean),
          interests: interestsText.split(',').map((item) => item.trim()).filter(Boolean),
          instagram: instagram.trim(),
          ageRange: ageRange.trim(),
          gender,
          publicGender: gender === 'prefer_not_to_say' ? false : publicGender,
        },
        token,
      );
      await updateUser(response.data);
      setUploadMessage('Profile updated.');
    } catch (error: any) {
      Alert.alert('Unable to save profile', error?.response?.data?.message || 'Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
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
            {user?.verified ? (
              <View style={styles.verifiedDot}>
                <Ionicons name="checkmark" size={14} color={colors.primaryText} />
              </View>
            ) : null}
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.location}>{location}</Text>
          </View>
          <Text style={styles.bio} numberOfLines={3}>
            {user?.bio || 'Curates high-quality plans with thoughtful people, polished details, and good energy.'}
          </Text>
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

      <View style={styles.trustCard}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
        <Text style={styles.trustText}>
          Profile photos are required before joining activities so everyone can see who is attending.
        </Text>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{displayHostedCount}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{displayJoinedCount}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{displayRating}</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Beta profile</Text>
        <TextInput
          value={aboutMe}
          onChangeText={setAboutMe}
          style={[styles.input, styles.textArea]}
          placeholder="About Me"
          placeholderTextColor={colors.textSubtle}
          multiline
        />
        <TextInput value={profileLocation} onChangeText={setProfileLocation} style={styles.input} placeholder="Location, e.g. Phuket" placeholderTextColor={colors.textSubtle} />
        <TextInput value={languagesText} onChangeText={setLanguagesText} style={styles.input} placeholder="Languages, comma separated" placeholderTextColor={colors.textSubtle} />
        <TextInput value={interestsText} onChangeText={setInterestsText} style={styles.input} placeholder="Interests, comma separated" placeholderTextColor={colors.textSubtle} />
        <TextInput value={instagram} onChangeText={setInstagram} style={styles.input} placeholder="Instagram optional" placeholderTextColor={colors.textSubtle} autoCapitalize="none" />
        <TextInput value={ageRange} onChangeText={setAgeRange} style={styles.input} placeholder="Age range optional, e.g. 25-34" placeholderTextColor={colors.textSubtle} />
        <Text style={styles.fieldLabel}>Host gender</Text>
        <View style={styles.genderGrid}>
          {genderOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[styles.genderChip, gender === option.value && styles.genderChipActive]}
              onPress={() => {
                setGender(option.value);
                if (option.value === 'prefer_not_to_say') setPublicGender(false);
              }}
            >
              <Text style={[styles.genderChipText, gender === option.value && styles.genderChipTextActive]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <TouchableOpacity
          style={[styles.visibilityToggle, (gender === 'prefer_not_to_say') && styles.visibilityToggleDisabled]}
          onPress={() => gender !== 'prefer_not_to_say' && setPublicGender((value) => !value)}
          disabled={gender === 'prefer_not_to_say'}
        >
          <Ionicons name={publicGender && gender !== 'prefer_not_to_say' ? 'eye-outline' : 'eye-off-outline'} size={17} color={colors.primary} />
          <Text style={styles.visibilityToggleText}>
            {publicGender && gender !== 'prefer_not_to_say' ? 'Visible on public profile' : 'Hidden from public profile'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.saveProfileButton} onPress={handleSaveProfile} disabled={savingProfile}>
          <Text style={styles.saveProfileText}>{savingProfile ? 'Saving...' : 'Save profile'}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification</Text>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <View key={badge.label} style={styles.badge}>
              <Ionicons name={badge.icon as any} size={16} color={colors.primary} />
              <Text style={styles.badgeText}>{badge.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Interests</Text>
        <View style={styles.interestTags}>
          {interests.map((interest) => (
            <View key={interest} style={styles.interestTag}>
              <Text style={styles.interestText}>{interest}</Text>
            </View>
          ))}
        </View>
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

        <View style={styles.activityColumn}>
          <Text style={styles.sectionTitle}>Hosted</Text>
          {hosted.length ? hosted.map((activity) => (
            <View key={activity.title} style={styles.activityRow}>
              <Ionicons name="star-outline" size={16} color={colors.primary} />
              <View style={styles.activityTextBlock}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityMeta}>{activity.meta}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>No hosted activities yet.</Text>}
        </View>

        <View style={styles.activityColumn}>
          <Text style={styles.sectionTitle}>Joined</Text>
          {joined.length ? joined.map((activity) => (
            <View key={activity.title} style={styles.activityRow}>
              <Ionicons name="calendar-outline" size={16} color={colors.primary} />
              <View style={styles.activityTextBlock}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityMeta}>{activity.meta}</Text>
              </View>
            </View>
          )) : <Text style={styles.emptyText}>No joined activities yet.</Text>}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Ionicons name="add-circle-outline" size={18} color={colors.primaryText} />
          <Text style={styles.actionButtonText}>Host an experience</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={18} color={colors.primary} />
          <Text style={styles.secondaryActionText}>Notifications</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={logout}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={styles.legalSection}>
        <TouchableOpacity style={styles.legalRow} onPress={() => openPolicyLink('privacy')}>
          <Text style={styles.legalText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={16} color={colors.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.legalRow} onPress={() => openPolicyLink('terms')}>
          <Text style={styles.legalText}>Terms of Service</Text>
          <Ionicons name="open-outline" size={16} color={colors.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.legalRow} onPress={() => openPolicyLink('community-guidelines')}>
          <Text style={styles.legalText}>Community Guidelines</Text>
          <Ionicons name="open-outline" size={16} color={colors.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount}>
          <Text style={styles.deleteAccountText}>Delete account</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 48 : spacing.xxl,
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
  fieldLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  genderGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.sm,
  },
  genderChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  genderChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.goldWash,
  },
  genderChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '900',
  },
  genderChipTextActive: {
    color: colors.primary,
  },
  visibilityToggle: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surfaceSoft,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  visibilityToggleDisabled: {
    opacity: 0.6,
  },
  visibilityToggleText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
    marginLeft: spacing.sm,
  },
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
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  textArea: {
    minHeight: 92,
    textAlignVertical: 'top',
  },
  saveProfileButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    alignItems: 'center',
    paddingVertical: 13,
  },
  saveProfileText: {
    color: colors.primaryText,
    fontWeight: '900',
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
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: spacing.sm,
  },
  signOutText: {
    color: colors.textSubtle,
    fontWeight: '700',
  },
  legalSection: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
  },
  legalRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  legalText: {
    color: colors.textMuted,
    fontWeight: '800',
  },
  deleteAccountButton: {
    minHeight: 44,
    justifyContent: 'center',
  },
  deleteAccountText: {
    color: colors.danger,
    fontWeight: '900',
  },
});
