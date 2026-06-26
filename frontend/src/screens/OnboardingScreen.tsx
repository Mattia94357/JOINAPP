import React from 'react';
import { ImageBackground, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../theme';
import { getActivityCoverImage } from '../utils/activityAssets';
import ResponsiveAppContainer from '../components/ResponsiveAppContainer';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const heroImage = getActivityCoverImage('Food', 'join-entry');

export default function OnboardingScreen({ navigation }: Props) {
  return (
    <ImageBackground source={{ uri: heroImage }} style={styles.background} resizeMode="cover">
      <View style={styles.overlay} />
      <ResponsiveAppContainer style={styles.responsiveShell}>
      <SafeAreaView style={styles.container}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>J</Text>
          </View>
          <Text style={styles.brand}>JOIN</Text>
        </View>

        <View style={styles.copy}>
          <View style={styles.pill}>
            <Ionicons name="star-outline" size={15} color={colors.primary} />
            <Text style={styles.pillText}>Curated social plans</Text>
          </View>
          <Text style={styles.title}>Real plans. Real people.</Text>
          <Text style={styles.subtitle}>Meet through activities, not endless scrolling.</Text>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.replace('Login', { mode: 'register' })}
          >
            <Text style={styles.primaryButtonText}>Create account</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.replace('Login', { mode: 'login' })}
          >
            <Text style={styles.secondaryButtonText}>Log in</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      </ResponsiveAppContainer>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    backgroundColor: colors.background,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  responsiveShell: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMark: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  logoText: {
    color: colors.primaryText,
    fontSize: 20,
    fontWeight: '900',
  },
  brand: {
    color: colors.text,
    fontSize: 24,
    fontWeight: '900',
  },
  copy: {
    marginTop: 'auto',
    marginBottom: spacing.xxl,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(0,0,0,0.48)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: spacing.md,
  },
  pillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
    marginLeft: 6,
  },
  title: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 47,
    fontWeight: '900',
    maxWidth: 360,
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    marginTop: spacing.md,
    maxWidth: 320,
  },
  actions: {
    width: '100%',
    paddingBottom: spacing.sm,
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  primaryButtonText: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: '900',
  },
  secondaryButton: {
    marginTop: spacing.md,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(0,0,0,0.42)',
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
});
