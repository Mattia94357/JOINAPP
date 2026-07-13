import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  compact?: boolean;
  desktop?: boolean;
};

export default function PreAuthBranding({ compact = false, desktop = false }: Props) {
  return (
    <View style={styles.container}>
      <Text style={[styles.wordmark, compact && styles.wordmarkCompact, desktop && styles.wordmarkDesktop]}>
        JOIN
      </Text>
      <View style={styles.headline}>
        <Text style={[styles.headlineLine, styles.headlineLead, compact && styles.headlineLeadCompact, desktop && styles.headlineLeadDesktop]}>
          Don’t get bored.
        </Text>
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.86}
          numberOfLines={1}
          style={[styles.headlineLine, styles.headlineMain, compact && styles.headlineMainCompact, desktop && styles.headlineMainDesktop]}
        >
          Find your next activity.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
  },
  wordmark: {
    color: colors.primary,
    fontFamily: 'System',
    fontSize: 58,
    lineHeight: 62,
    fontWeight: '900',
    letterSpacing: 5,
    textAlign: 'center',
    textShadowColor: 'rgba(246,196,69,0.12)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  wordmarkCompact: {
    fontSize: 46,
    lineHeight: 50,
    letterSpacing: 4,
  },
  wordmarkDesktop: {
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: 6,
  },
  headline: {
    marginTop: 20,
    alignItems: 'center',
  },
  headlineLine: {
    color: colors.text,
    fontFamily: 'System',
    fontWeight: '800',
    textAlign: 'center',
  },
  headlineLead: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  headlineLeadCompact: {
    fontSize: 24,
    lineHeight: 29,
  },
  headlineLeadDesktop: {
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: -1.2,
  },
  headlineMain: {
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: -1,
  },
  headlineMainCompact: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  headlineMainDesktop: {
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -1.5,
  },
});
