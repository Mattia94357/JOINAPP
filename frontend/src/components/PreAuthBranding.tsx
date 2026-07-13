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
        <Text style={[styles.headlineLine, compact && styles.headlineLineCompact, desktop && styles.headlineLineDesktop]}>
          Don’t get bored.
        </Text>
        <Text style={[styles.headlineLine, compact && styles.headlineLineCompact, desktop && styles.headlineLineDesktop]}>
          <Text style={[styles.headlineJoin, compact && styles.headlineJoinCompact, desktop && styles.headlineJoinDesktop]}>JOIN</Text>
          {' activities.'}
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
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1,
    textAlign: 'center',
  },
  headlineLineCompact: {
    fontSize: 28,
    lineHeight: 33,
    letterSpacing: -0.6,
  },
  headlineLineDesktop: {
    fontSize: 56,
    lineHeight: 62,
    letterSpacing: -1.8,
  },
  headlineJoin: {
    color: colors.primary,
    fontSize: 43,
    lineHeight: 43,
    fontWeight: '900',
  },
  headlineJoinCompact: {
    fontSize: 32,
    lineHeight: 33,
  },
  headlineJoinDesktop: {
    fontSize: 64,
    lineHeight: 62,
  },
});
