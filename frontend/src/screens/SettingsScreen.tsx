import React from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { deleteAccountRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: Props) {
  const { token, logout } = useAuth();

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
      'This permanently removes your JOIN account.',
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Settings</Text>
      <Text style={styles.subtitle}>Account, privacy, and safety controls.</Text>

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Notifications')}>
          <View style={styles.rowIcon}><Ionicons name="notifications-outline" size={19} color={colors.primary} /></View>
          <Text style={styles.rowText}>Notifications</Text>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.rowIcon}><Ionicons name="person-outline" size={19} color={colors.primary} /></View>
          <Text style={styles.rowText}>Edit profile and privacy</Text>
          <Ionicons name="chevron-forward-outline" size={18} color={colors.textSubtle} />
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.row} onPress={() => openPolicyLink('privacy')}>
          <Text style={styles.rowText}>Privacy Policy</Text>
          <Ionicons name="open-outline" size={18} color={colors.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => openPolicyLink('terms')}>
          <Text style={styles.rowText}>Terms of Service</Text>
          <Ionicons name="open-outline" size={18} color={colors.textSubtle} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.row} onPress={() => openPolicyLink('community-guidelines')}>
          <Text style={styles.rowText}>Community Guidelines</Text>
          <Ionicons name="open-outline" size={18} color={colors.textSubtle} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={logout}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteText}>Delete account</Text>
      </TouchableOpacity>
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
    maxWidth: 500,
    alignSelf: 'center',
    padding: spacing.lg,
    paddingBottom: 80,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: spacing.xs,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  section: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  row: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: colors.goldWash,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  rowText: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  signOutButton: {
    minHeight: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  signOutText: {
    color: colors.primary,
    fontWeight: '900',
    fontSize: 15,
  },
  deleteButton: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  deleteText: {
    color: colors.danger,
    fontWeight: '900',
  },
});
