import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { fetchPublicUserRequest, ApiUser } from '../api';
import { getAvatarUrl } from '../utils/avatar';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'PublicProfile'>;

export default function PublicProfileScreen({ route }: Props) {
  const { userId, fallbackName, fallbackAvatar } = route.params;
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
  const image = profile?.profilePictureUrl || profile?.profileThumbnailUrl || profile?.avatar || fallbackAvatar || getAvatarUrl(name, 256);
  const interests = profile?.interests?.length ? profile.interests : ['Wellness', 'Food', 'Networking'];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Image source={{ uri: image }} style={styles.heroImage} />
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.meta}>{profile?.location || 'Location private'}</Text>
      <Text style={styles.bio}>{profile?.bio || 'JOIN member building real-world social plans.'}</Text>

      <View style={styles.badges}>
        <View style={styles.badge}><Ionicons name="shield-checkmark-outline" size={15} color={colors.primary} /><Text style={styles.badgeText}>{profile?.verified ? 'Verified' : 'Profile reviewed'}</Text></View>
        <View style={styles.badge}><Ionicons name="star-outline" size={15} color={colors.primary} /><Text style={styles.badgeText}>{profile?.hostRating || 4.9} rating</Text></View>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statValue}>{profile?.hostedCount ?? 12}</Text><Text style={styles.statLabel}>Hosted</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{profile?.joinedCount ?? 47}</Text><Text style={styles.statLabel}>Joined</Text></View>
        <View style={styles.stat}><Text style={styles.statValue}>{profile?.hostRating ?? 4.9}</Text><Text style={styles.statLabel}>Rating</Text></View>
      </View>

      <Text style={styles.sectionTitle}>Interests</Text>
      <View style={styles.tags}>
        {interests.map((interest) => <Text key={interest} style={styles.tag}>{interest}</Text>)}
      </View>

      <Text style={styles.sectionTitle}>Recent activity</Text>
      {[...(profile?.hostedActivities || []), ...(profile?.joinedActivities || [])].slice(0, 5).map((activity, index) => (
        <View key={activity._id || index} style={styles.activityRow}>
          <Ionicons name="calendar-outline" size={16} color={colors.primary} />
          <View style={styles.activityCopy}>
            <Text style={styles.activityTitle}>{activity.title}</Text>
            <Text style={styles.activityMeta}>{activity.category} - {activity.location}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.lg, paddingBottom: 80 },
  heroImage: { width: 112, height: 112, borderRadius: 56, borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.surface },
  name: { color: colors.text, fontSize: 30, fontWeight: '900', marginTop: spacing.md },
  meta: { color: colors.textMuted, fontSize: 14, marginTop: spacing.xs },
  bio: { color: colors.textMuted, lineHeight: 22, marginTop: spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  badge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  badgeText: { color: colors.text, fontWeight: '800', marginLeft: spacing.xs, fontSize: 12 },
  stats: { flexDirection: 'row', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingVertical: spacing.md, marginTop: spacing.md },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  statLabel: { color: colors.textSubtle, fontSize: 12 },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: '900', textTransform: 'uppercase', marginTop: spacing.lg, marginBottom: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { color: colors.primaryText, backgroundColor: colors.primary, borderRadius: 999, paddingHorizontal: spacing.md, paddingVertical: 7, fontWeight: '900', fontSize: 12 },
  activityRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, padding: spacing.md, marginBottom: spacing.sm },
  activityCopy: { flex: 1, marginLeft: spacing.md },
  activityTitle: { color: colors.text, fontWeight: '900' },
  activityMeta: { color: colors.textSubtle, fontSize: 12, marginTop: 2 },
});
