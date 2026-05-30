import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import AvatarBadge from '../components/AvatarBadge';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export default function ProfileScreen({ navigation }: Props) {
  const { user, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.profileCard}>
        <AvatarBadge name={user?.name || 'Guest'} avatarUrl={user?.avatar} size={84} />
        <Text style={styles.name}>{user?.name || 'Guest'}</Text>
        <Text style={styles.handle}>{user?.email || 'connect@joinapp.com'}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.sectionText}>Discover activities matching your schedule, tastes, and pace.</Text>
      </View>

      <View style={styles.section}> 
        <Text style={styles.sectionTitle}>Next steps</Text>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('CreateActivity')}>
          <Text style={styles.optionText}>Host your first experience</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.option} onPress={() => navigation.navigate('Notifications')}>
          <Text style={styles.optionText}>See your notifications</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutText}>Sign out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050505',
    padding: 22,
    paddingBottom: 40,
  },
  profileCard: {
    backgroundColor: '#111',
    borderRadius: 26,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  name: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
    marginTop: 16,
  },
  handle: {
    color: '#aaa',
    marginTop: 8,
    fontSize: 14,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionText: {
    color: '#bbb',
    fontSize: 14,
    lineHeight: 22,
  },
  option: {
    backgroundColor: '#111',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 16,
    marginTop: 12,
  },
  optionText: {
    color: '#f5c12d',
    fontWeight: '700',
    fontSize: 15,
  },
  logoutButton: {
    marginTop: 12,
    backgroundColor: '#f5c12d',
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
  },
  logoutText: {
    color: '#050505',
    fontWeight: '800',
  },
});
