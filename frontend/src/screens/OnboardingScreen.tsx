import React from 'react';
import { Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../theme';
import { getActivityCoverImage } from '../utils/activityAssets';

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

const collageTiles = [
  { category: 'Food', left: '-5%', top: '-13%', width: '24%', height: '48%', rotate: '-20deg' },
  { category: 'Culture', left: '15%', top: '9%', width: '23%', height: '50%', rotate: '14deg' },
  { category: 'Wellness', left: '37%', top: '-11%', width: '24%', height: '48%', rotate: '-13deg' },
  { category: 'Nightlife', left: '60%', top: '8%', width: '23%', height: '50%', rotate: '12deg' },
  { category: 'Beach', left: '82%', top: '-12%', width: '23%', height: '48%', rotate: '-16deg' },
  { category: 'Networking', left: '-2%', top: '50%', width: '23%', height: '47%', rotate: '13deg' },
  { category: 'Adventure', left: '22%', top: '52%', width: '24%', height: '49%', rotate: '-14deg' },
  { category: 'Music', left: '50%', top: '51%', width: '24%', height: '49%', rotate: '15deg' },
  { category: 'Dating & Singles', left: '78%', top: '53%', width: '23%', height: '48%', rotate: '-12deg' },
] as const;

export default function OnboardingScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;
  const visibleTiles = isDesktop ? collageTiles : collageTiles.slice(0, 5);

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.collage}>
        {visibleTiles.map((tile, index) => (
          <View
            key={tile.category}
            style={[
              styles.tile,
              {
                left: tile.left,
                top: tile.top,
                width: tile.width,
                height: tile.height,
                transform: [{ rotate: tile.rotate }],
                zIndex: index,
              },
            ]}
          >
            <Image source={{ uri: getActivityCoverImage(tile.category, `entry-${index}`) }} style={styles.tileImage} />
            <View style={styles.tileChrome} />
          </View>
        ))}
      </View>
      <View pointerEvents="none" style={styles.overlay} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}><Text style={styles.logoText}>J</Text></View>
            <Text style={styles.brand}>JOIN</Text>
          </View>
          {isDesktop ? (
            <TouchableOpacity style={styles.topLoginButton} onPress={() => navigation.replace('Login', { mode: 'login' })}>
              <Text style={styles.topLoginText}>Log in</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.hero}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Real plans.{`\n`}Real people.</Text>
          <Text style={styles.subtitle}>Meet through activities, not endless scrolling.</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.replace('Login', { mode: 'register' })}>
            <Text style={styles.primaryButtonText}>Create account</Text>
          </TouchableOpacity>
          {!isDesktop ? (
            <TouchableOpacity style={styles.mobileLoginButton} onPress={() => navigation.replace('Login', { mode: 'login' })}>
              <Text style={styles.mobileLoginText}>Log in</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <Text style={styles.footer}>Plans worth showing up for.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#080808', overflow: 'hidden' },
  collage: { ...StyleSheet.absoluteFillObject, opacity: 0.95 },
  tile: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 5,
    borderColor: '#141414',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  tileImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  tileChrome: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', borderRadius: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.62)' },
  safeArea: { flex: 1, paddingHorizontal: spacing.xl, paddingTop: spacing.md, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  topBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandRow: { flexDirection: 'row', alignItems: 'center' },
  logoMark: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: spacing.sm },
  logoText: { color: colors.primaryText, fontSize: 20, fontWeight: '900' },
  brand: { color: colors.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.8 },
  topLoginButton: { minWidth: 112, height: 44, paddingHorizontal: spacing.lg, borderRadius: 999, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  topLoginText: { color: colors.primaryText, fontSize: 15, fontWeight: '900' },
  hero: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingBottom: 12 },
  title: { color: colors.text, fontSize: 48, lineHeight: 52, fontWeight: '900', letterSpacing: -2, textAlign: 'center' },
  titleDesktop: { fontSize: 76, lineHeight: 78, letterSpacing: -3.2 },
  subtitle: { maxWidth: 350, color: 'rgba(255,255,255,0.82)', fontSize: 17, lineHeight: 25, fontWeight: '700', textAlign: 'center', marginTop: spacing.md },
  primaryButton: { minWidth: 180, minHeight: 54, marginTop: spacing.xl, paddingHorizontal: spacing.lg, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 10 },
  primaryButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '900' },
  mobileLoginButton: { marginTop: spacing.md, minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  mobileLoginText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  footer: { color: 'rgba(255,255,255,0.58)', fontSize: 12, fontWeight: '800', textAlign: 'center', letterSpacing: 0.2 },
});
