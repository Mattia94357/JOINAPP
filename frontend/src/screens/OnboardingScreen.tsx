import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { RootStackParamList } from '../../App';
import { colors, spacing } from '../theme';

const slides = [
  {
    eyebrow: 'Discover',
    icon: 'star-outline' as const,
    title: 'Plans worth leaving the house for',
    description: 'Curated local activities with hosts, context and availability up front.',
  },
  {
    eyebrow: 'Join',
    icon: 'people-outline' as const,
    title: 'Know the room before you arrive',
    description: 'See the vibe, capacity and who is coming so every yes feels considered.',
  },
  {
    eyebrow: 'Host',
    icon: 'calendar-outline' as const,
    title: 'Turn good ideas into live plans',
    description: 'Create polished activities, manage interest and keep the conversation moving.',
  },
];

const SWIPE_THRESHOLD = 42;

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const [current, setCurrent] = useState(0);
  const slideProgress = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    slideProgress.setValue(0);
    Animated.timing(slideProgress, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [current, slideProgress]);

  const animatedSlideStyle = {
    opacity: slideProgress,
    transform: [
      {
        translateY: slideProgress.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  };

  const nextSlide = () => {
    if (current === slides.length - 1) {
      navigation.replace('Login');
    } else {
      setCurrent(current + 1);
    }
  };

  const previousSlide = () => {
    setCurrent((value) => Math.max(value - 1, 0));
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 12 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx < -SWIPE_THRESHOLD) {
            setCurrent((value) => Math.min(value + 1, slides.length - 1));
          } else if (gesture.dx > SWIPE_THRESHOLD) {
            previousSlide();
          }
        },
      }),
    [],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <View style={styles.brandRow}>
          <View style={styles.logoMark}>
            <Text style={styles.logoText}>J</Text>
          </View>
          <Text style={styles.brand}>JoinApp</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${((current + 1) / slides.length) * 100}%` }]} />
        </View>

        <Animated.View style={[styles.slideContent, animatedSlideStyle]} {...panResponder.panHandlers}>
          <View style={styles.visualPanel}>
            <View style={styles.goldGlow} />
            <View style={styles.iconBubble}>
              <Ionicons name={slides[current].icon} size={34} color={colors.primaryText} />
            </View>
            <View style={styles.previewCard}>
              <Text style={styles.previewLabel}>Tonight</Text>
              <Text style={styles.previewTitle}>Rooftop supper club</Text>
              <Text style={styles.previewMeta}>6 going - 2 spots - Verified host</Text>
            </View>
          </View>

          <Text style={styles.eyebrow}>{slides[current].eyebrow}</Text>
          <Text style={styles.title}>{slides[current].title}</Text>
          <Text style={styles.description}>{slides[current].description}</Text>
          <View style={styles.swipeHint}>
            <Ionicons name="arrow-back-outline" size={14} color={colors.textSubtle} />
            <Text style={styles.swipeHintText}>Swipe to explore</Text>
            <Ionicons name="arrow-forward-outline" size={14} color={colors.textSubtle} />
          </View>
        </Animated.View>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, current === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.button} onPress={nextSlide}>
          <Text style={styles.buttonText}>{current === slides.length - 1 ? 'Create your account' : 'Continue'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.skipButton} onPress={() => navigation.replace('Login')}>
          <Text style={styles.skip}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'space-between',
    padding: spacing.xl,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
  },
  slideContent: {
    width: '100%',
  },
  brandRow: {
    position: 'absolute',
    top: spacing.md,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoMark: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  logoText: {
    color: colors.primaryText,
    fontSize: 18,
    fontWeight: '900',
  },
  brand: {
    color: colors.text,
    fontSize: 23,
    fontWeight: '900',
  },
  progressTrack: {
    position: 'absolute',
    top: 70,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: colors.surfaceSoft,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
  },
  visualPanel: {
    minHeight: 188,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: spacing.lg,
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
    overflow: 'hidden',
    elevation: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.42,
    shadowRadius: 28,
  },
  goldGlow: {
    position: 'absolute',
    top: -64,
    right: -48,
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.goldWash,
  },
  iconBubble: {
    width: 68,
    height: 68,
    borderRadius: 8,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCard: {
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 8,
    padding: spacing.md,
  },
  previewLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '900',
  },
  previewMeta: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
    marginBottom: spacing.md,
  },
  description: {
    color: colors.textMuted,
    fontSize: 17,
    lineHeight: 26,
  },
  swipeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  swipeHintText: {
    color: colors.textSubtle,
    fontSize: 12,
    fontWeight: '800',
    marginHorizontal: spacing.sm,
    textTransform: 'uppercase',
  },
  footer: {
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    marginHorizontal: spacing.xs,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  button: {
    backgroundColor: colors.primary,
    width: '100%',
    paddingVertical: 17,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '900',
    fontSize: 16,
  },
  skipButton: {
    paddingVertical: spacing.sm,
  },
  skip: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
