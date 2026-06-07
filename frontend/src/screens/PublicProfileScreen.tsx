import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { blockUserRequest, fetchPublicUserRequest, reportUserRequest, ApiUser } from '../api';
import AvatarBadge from '../components/AvatarBadge';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen({ route }: Props) {
  const { userId, fallbackName, fallbackAvatar } = route.params;
  const { token, user } = useAuth();
  const [profile, setProfile] = useState<(ApiUser & { hostedActivities?: any[]; joinedActivities?: any[] }) | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));

  useEffect(() => {
    const load = async () => {
      if (!userId) return;
      setLoading(true);
      try {
        const response = await fetchPublicUserRequest(userId);
        setProfile(response.data);
      } catch (error) {
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [userId]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const name = profile?.name || fallbackName || 'JOIN member';
  const image = profile?.profilePictureUrl || profile?.profileThumbnailUrl || (profile?.profileCompleted ? profile?.avatar : undefined) || fallbackAvatar;
  const interests = profile?.interests?.length ? profile.interests : ['Wellness', 'Food', 'Networking'];
  const languages = profile?.languages?.length ? profile.languages : ['English'];
  const targetUserId = profile?.id || userId;
  const recentActivities = [...(profile?.hostedActivities || []), ...(profile?.joinedActivities || [])].slice(0, 5);

  const handleReport = async () => {
    if (!token || !targetUserId) {
      Alert.alert('Sign in required', 'Please log in to report a user.');
      return;
    }

    try {
      await reportUserRequest(targetUserId, token, 'Reported from public profile safety action.');
      Alert.alert('Report submitted', 'Thanks for helping keep JOIN safe.');
    } catch (error: any) {
      Alert.alert('Unable to report', error?.response?.data?.message || 'Please try again later.');
    }
  };

  const handleBlock = async () => {
    if (!token || !targetUserId) {
      Alert.alert('Sign in required', 'Please log in to block a user.');
      return;
    }

    try {
      await blockUserRequest(targetUserId, token);
      Alert.alert('User blocked', 'You will have fewer interactions with this member.');
    } catch (error: any) {
      Alert.alert('Unable to block', error?.response?.data?.message || 'Please try again later.');
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <AvatarBadge name={name} avatarUrl={image} size={112} />
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{profile?.location || 'Location private'}</Text>
      <Text style={styles.bio}>{profile?.aboutMe || profile?.bio || 'JOIN member building real-world social plans.'}</Text>

      <View style={styles.badges}>
        <View style={styles.badge}><Ionicons name="mail-open-outline" size={15} color={colors.primary} /><Text style={styles.badgeText}>Verified Email</Text></View>
        <View style={styles.badge}><Ionicons name="camera-outline" size={15} color={colors.primary} /><Text style={styles.badgeText}>{profile?.profilePictureUrl ? 'Profile Photo Added' : 'Photo pending'}</Text></View>
        <View style={styles.badge}><Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} /><Text style={styles.badgeText}>{profile?.verified ? 'Verified' : 'Community Active'}</Text></View>
        <View style={styles.badge}><Ionicons name="star-outline" size={15} color={colors.primary} /><Text style={styles.badgeText}>{profile?.hostRating || 4.9} rating</Text></View>
      </View>

      {targetUserId && targetUserId !== user?.id ? (
        <View style={styles.safetyActions}>
          <TouchableOpacity style={styles.safetyButton} onPress={handleReport}>
            <Ionicons name="flag-outline" size={16} color={colors.primary} />
            <Text style={styles.safetyText}>Report user</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.safetyButton} onPress={handleBlock}>
            <Ionicons name="remove-circle-outline" size={16} color={colors.danger} />
            <Text style={styles.safetyText}>Block user</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statValue}>{profile?.hostedCount ?? 12}</Text><Text style={styles.statLabel}>Hosted</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{profile?.joinedCount ?? 47}</Text><Text style={styles.statLabel}>Joined</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{profile?.hostRating ?? 4.9}</Text><Text style={styles.statLabel}>Rating</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Interests</Text>
      <View style={styles.tags}>
        {interests.map((interest) => <Text key={interest} style={styles.tag}>{interest}</Text>)}
      </View>

      <Text style={styles.sectionTitle}>Languages</Text>
      <View style={styles.tags}>
        {languages.map((language) => <Text key={language} style={styles.tagSecondary}>{language}</Text>)}
      </View>

      {profile?.ageRange || profile?.instagram ? (
        <View style={styles.profileFacts}>
          {profile?.ageRange ? <Text style={styles.factText}>Age range: {profile.ageRange}</Text> : null}
          {profile?.instagram ? <Text style={styles.factText}>Instagram: {profile.instagram}</Text> : null}
        </View>
      ) : null}

      <Text style={styles.sectionTitle}>Recent activity</Text>
      {recentActivities.length ? recentActivities.map((activity, index) => (
        <View key={activity._id || index} style={styles.activityRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <View style={styles.activityCopy}>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <Text style={styles.activityMeta}>{activity.category} - {activity.location}</Text>
          </View>
        </View>
      )) : <Text style={styles.emptyText}>No public activity yet.</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: spacing.lg, paddingBottom: 80 },
  name: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: spacing.md },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  bio: { color: colors.textMuted, lineHeight: 22, marginTop: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  badgeText: { color: colors.text, fontWeight: '800', marginLeft: spacing.xs, fontSize: 12 },
  safetyActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  safetyButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  safetyText: { color: colors.text, fontWeight: '900', marginLeft: spacing.xs, fontSize: 12 },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.md, marginTop: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: colors.textSubtle, fontSize: 12 },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { color: colors.primaryText, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, fontWeight: '900', fontSize: 12 },
  tagSecondary: { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, fontWeight: '900', fontSize: 12 },
  profileFacts: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: spacing.md, marginTop: spacing.md },
  factText: { color: colors.textMuted, fontWeight: '700', marginBottom: 4 },
  activityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm },
  activityCopy: { flex: 1, marginLeft: spacing.md },
  activityTitle: { color: colors.text, fontWeight: '900' },
  activityMeta: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
  emptyText: { color: colors.textSubtle, fontSize: 13, fontWeight: '700' },
});
