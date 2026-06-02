import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { getAvatarUrl } from '../utils/avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

const hosted = [
  { title: 'Rooftop dinner circle', meta: 'Food · 10 guests' },
  { title: 'Founders coffee walk', meta: 'Networking · 8 guests' },
  { title: 'Reset yoga session', meta: 'Wellness · 12 guests' },
];

const joined = [
  { title: 'Gallery opening night', meta: 'Tonight · 1.4 km' },
  { title: 'Trail hike + brunch', meta: 'This weekend · 2.4 km' },
];

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();
  const interests = user?.interests?.length ? user.interests : ['Wellness', 'Food', 'Networking', 'Culture'];
  const location = user?.location || 'Perth, Australia';
  const profileImage = user?.avatar || getAvatarUrl(user?.name || 'Guest', 256);
  const badges = [
    { icon: 'shield-checkmark-outline', label: user?.verified ? 'Identity verified' : 'Profile reviewed' },
    { icon: 'star-outline', label: 'Trusted host' },
    { icon: 'people-outline', label: 'Community active' },
  ];

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Image source={{ uri: profileImage }} style={styles.profileImage} />
        <View style={styles.profileCopy}>
          <View style={styles.nameRow}>
            <Text style={styles.name}>{user?.name || 'Guest'}</Text>
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={14} color="#050505" />
            </View>
          </View>
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={14} color="#f5c12d" />
            <Text style={styles.location}>{location}</Text>
          </View>
          <Text style={styles.bio} numberOfLines={3}>
            {user?.bio || 'Curates high-quality plans with thoughtful people, polished details, and good energy.'}
          </Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{hosted.length}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>12</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>4.9</Text>
          <Text style={styles.statLabel}>Rating</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification</Text>
        <View style={styles.badgeGrid}>
          {badges.map((badge) => (
            <View key={badge.label} style={styles.badge}>
              <Ionicons name={badge.icon as any} size={16} color="#f5c12d" />
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
          <Text style={styles.sectionTitle}>Hosted</Text>
          {hosted.map((activity) => (
            <View key={activity.title} style={styles.activityRow}>
              <Ionicons name="star-outline" size={16} color="#f5c12d" />
              <View style={styles.activityTextBlock}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityMeta}>{activity.meta}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.activityColumn}>
          <Text style={styles.sectionTitle}>Joined</Text>
          {joined.map((activity) => (
            <View key={activity.title} style={styles.activityRow}>
              <Ionicons name="calendar-outline" size={16} color="#f5c12d" />
              <View style={styles.activityTextBlock}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityMeta}>{activity.meta}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Ionicons name="add-circle-outline" size={18} color="#050505" />
          <Text style={styles.actionButtonText}>Host an experience</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.secondaryAction} onPress={() => navigation.navigate('Notifications')}>
          <Ionicons name="notifications-outline" size={18} color="#f5c12d" />
          <Text style={styles.secondaryActionText}>Notifications</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={logout}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: '#050505',
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#242018',
    borderRadius: 12,
    padding: 12,
  },
  profileImage: {
    width: 92,
    height: 92,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#f5c12d',
    backgroundColor: '#111111',
  },
  profileCopy: {
    flex: 1,
    marginLeft: 13,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: '900',
    flexShrink: 1,
  },
  verifiedDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f5c12d',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  location: {
    color: '#d5d5d5',
    fontSize: 13,
    marginLeft: 5,
  },
  bio: {
    color: '#aaa',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 8,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#0d0d0d',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#222222',
    marginTop: 12,
    paddingVertical: 12,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#f5c12d',
    fontSize: 22,
    fontWeight: '900',
  },
  statLabel: {
    color: '#929292',
    fontSize: 12,
    marginTop: 2,
  },
  section: {
    marginTop: 16,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: 9,
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
    borderColor: '#2d2716',
    backgroundColor: '#111111',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  badgeText: {
    color: '#eeeeee',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
  interestTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: '#f5c12d',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    color: '#050505',
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
    backgroundColor: '#101010',
    borderWidth: 1,
    borderColor: '#222222',
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
  },
  activityTextBlock: {
    flex: 1,
    marginLeft: 9,
  },
  activityTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  activityMeta: {
    color: '#9a9a9a',
    fontSize: 12,
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  actionButton: {
    flex: 1.4,
    backgroundColor: '#f5c12d',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginRight: 10,
  },
  actionButtonText: {
    color: '#050505',
    fontWeight: '900',
    marginLeft: 6,
  },
  secondaryAction: {
    flex: 1,
    borderColor: '#f5c12d',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  secondaryActionText: {
    color: '#f5c12d',
    fontWeight: '800',
    marginLeft: 6,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 13,
    marginTop: 8,
  },
  signOutText: {
    color: '#a0a0a0',
    fontWeight: '700',
  },
});
