import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, SafeAreaView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../theme';
import { getActivityCoverImage } from '../utils/activityAssets';
import Logo from '../components/Logo';

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
  const entrance = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(entrance, {
      toValue: 1,
      duration: 820,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
    const floating = Animated.loop(
      Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 7500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 7500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    floating.start();
    return () => floating.stop();
  }, [drift, entrance]);

  return (
    <View style={styles.screen}>
      <View pointerEvents="none" style={styles.collage}>
        {visibleTiles.map((tile, index) => (
          <Animated.View
            key={tile.category}
            style={[
              styles.tile,
              {
                left: tile.left,
                top: tile.top,
                width: tile.width,
                height: tile.height,
                transform: [
                  { rotate: tile.rotate },
                  { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [index % 2 ? -5 : 5, index % 2 ? 5 : -5] }) },
                  { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) },
                ],
                zIndex: index,
              },
            ]}
          >
            <Image source={{ uri: getActivityCoverImage(tile.category, `entry-${index}`) }} style={styles.tileImage} />
            <View style={styles.tileWarmth} />
            <View style={styles.tileChrome} />
          </Animated.View>
        ))}
      </View>
      <View pointerEvents="none" style={styles.overlay} />
      <View pointerEvents="none" style={styles.vignette} />

      <SafeAreaView style={styles.safeArea}>
        <Animated.View style={[styles.topBar, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }] }]}>
          <Logo size={42} withWordmark animate />
          {isDesktop ? (
            <TouchableOpacity activeOpacity={0.82} style={styles.topLoginButton} onPress={() => navigation.replace('Login', { mode: 'login' })}>
              <Text style={styles.topLoginText}>Log in</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>

        <Animated.View style={[styles.hero, { opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
          <Text style={[styles.title, isDesktop && styles.titleDesktop]}>Real plans{`\n`}Real people</Text>
          <Text style={styles.subtitle}>Meet people through experiences</Text>
          <TouchableOpacity activeOpacity={0.86} style={styles.primaryButton} onPress={() => navigation.replace('Login', { mode: 'register' })}>
            <Text style={styles.primaryButtonText}>Create account</Text>
          </TouchableOpacity>
          {!isDesktop ? (
            <TouchableOpacity activeOpacity={0.78} style={styles.mobileLoginButton} onPress={() => navigation.replace('Login', { mode: 'login' })}>
              <Text style={styles.mobileLoginText}>Log in</Text>
            </TouchableOpacity>
          ) : null}
        </Animated.View>

        <Animated.Text style={[styles.footer, { opacity: entrance }]}>Plans worth showing up for</Animated.Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0B', overflow: 'hidden' },
  collage: { ...StyleSheet.absoluteFillObject, opacity: 0.92 },
  tile: {
    position: 'absolute',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 5,
    borderColor: 'rgba(43,43,43,0.92)',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  tileImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  tileWarmth: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(246,196,69,0.1)' },
  tileChrome: { ...StyleSheet.absoluteFillObject, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 16 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  vignette: { ...StyleSheet.absoluteFillObject, borderWidth: 42, borderColor: 'rgba(0,0,0,0.28)' },
  safeArea: { flex: 1, paddingHorizontal: 24, paddingTop: spacing.md, paddingBottom: spacing.lg, justifyContent: 'space-between' },
  topBar: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLoginButton: { minWidth: 112, height: 46, paddingHorizontal: spacing.lg, borderRadius: 999, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 5 } },
  topLoginText: { color: colors.primaryText, fontSize: 15, fontWeight: '900' },
  hero: { flex: 1, width: '100%', maxWidth: 620, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingBottom: spacing.lg },
  title: { color: colors.text, fontSize: 48, lineHeight: 56, fontWeight: '900', fontFamily: 'System', letterSpacing: -2.2, textAlign: 'center' },
  titleDesktop: { fontSize: 76, lineHeight: 84, letterSpacing: -3.6 },
  subtitle: { maxWidth: 340, color: 'rgba(255,255,255,0.8)', fontSize: 17, lineHeight: 26, fontWeight: '700', textAlign: 'center', marginTop: spacing.lg },
  primaryButton: { minWidth: 196, minHeight: 58, marginTop: spacing.xxl, paddingHorizontal: spacing.xl, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.42, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
  primaryButtonText: { color: colors.primaryText, fontSize: 16, fontWeight: '900' },
  mobileLoginButton: { marginTop: spacing.lg, minHeight: 44, paddingHorizontal: spacing.lg, justifyContent: 'center' },
  mobileLoginText: { color: colors.text, fontSize: 15, fontWeight: '900' },
  footer: { color: 'rgba(255,255,255,0.58)', fontSize: 12, fontWeight: '800', textAlign: 'center', letterSpacing: 0.35 },
});
