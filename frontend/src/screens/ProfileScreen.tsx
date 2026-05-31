import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import AvatarBadge from '../components/AvatarBadge';
import { getAvatarUrl } from '../utils/avatar';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  // Mock data for hosted and joined activities (replace with real API calls later)
  const hostedActivities = 3;
  const joinedActivities = 12;
  const interests = ['Wellness', 'Food', 'Networking'];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <Image
          source={{ uri: user?.avatar || getAvatarUrl(user?.name || 'Guest') }}
          style={styles.profileImage}
        />
        {user?.verified && <Text style={styles.verificationBadge}>✓</Text>}
      </View>

      {/* Profile Info */}
      <View style={styles.profileInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>{user?.name || 'Guest'}</Text>
          {user?.verified && <Text style={styles.verifiedLabel}>Verified</Text>}
        </View>
        <Text style={styles.email}>{user?.email || 'connect@joinapp.com'}</Text>
        {user?.location && <Text style={styles.location}>📍 {user.location}</Text>}
        {user?.bio && <Text style={styles.bio}>{user.bio}</Text>}
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{hostedActivities}</Text>
          <Text style={styles.statLabel}>Hosted</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{joinedActivities}</Text>
          <Text style={styles.statLabel}>Joined</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.stat}>
          <Text style={styles.statValue}>{interests.length}</Text>
          <Text style={styles.statLabel}>Interests</Text>
        </View>
      </View>

      {/* Interests */}
      {interests.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests</Text>
          <View style={styles.interestTags}>
            {interests.map((interest, index) => (
              <View key={index} style={styles.interestTag}>
                <Text style={styles.interestText}>{interest}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('CreateActivity')}>
          <Text style={styles.actionButtonText}>🎯 Host an Experience</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.actionButtonText}>🔔 View Notifications</Text>
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={logout}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050505',
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: '#f5c12d',
    backgroundColor: '#111111',
  },
  verificationBadge: {
    position: 'absolute',
    bottom: 0,
    right: '25%',
    backgroundColor: '#f5c12d',
    color: '#050505',
    width: 30,
    height: 30,
    borderRadius: 15,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 30,
    borderWidth: 2,
    borderColor: '#050505',
  },
  profileInfo: {
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  name: {
    color: '#ffffff',
    fontSize: 26,
    fontWeight: '700',
    marginRight: 8,
  },
  verifiedLabel: {
    backgroundColor: '#f5c12d',
    color: '#050505',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  email: {
    color: '#b8b8b8',
    fontSize: 14,
    marginBottom: 6,
  },
  location: {
    color: '#888888',
    fontSize: 14,
    marginBottom: 8,
  },
  bio: {
    color: '#d1d1d1',
    fontSize: 14,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: '#111111',
    borderRadius: 14,
    padding: 16,
    marginBottom: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: '#f5c12d',
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    color: '#888888',
    fontSize: 12,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#222222',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  interestTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  interestTag: {
    backgroundColor: '#f5c12d',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
    marginBottom: 8,
  },
  interestText: {
    color: '#050505',
    fontSize: 12,
    fontWeight: '600',
  },
  actionButton: {
    backgroundColor: '#111111',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#222222',
  },
  actionButtonText: {
    color: '#f5c12d',
    fontWeight: '600',
    fontSize: 14,
    textAlign: 'center',
  },
  signOutButton: {
    backgroundColor: '#f5c12d',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  signOutText: {
    color: '#050505',
    fontWeight: '700',
    fontSize: 14,
  },
});
