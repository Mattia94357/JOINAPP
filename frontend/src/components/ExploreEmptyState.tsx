import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

export default function ExploreEmptyState({ onCreate }: { onCreate: () => void }) {
  return <View style={styles.empty} testID="explore-empty-state">
    <Ionicons name="calendar-outline" size={30} color={colors.primary} />
    <Text style={styles.heading}>No activities yet</Text>
    <Text style={styles.support}>Other people will be joining soon.</Text>
    <Text style={styles.support}>Create an activity to get things started.</Text>
    <TouchableOpacity style={styles.cta} onPress={onCreate} accessibilityRole="button" accessibilityLabel="Create activity">
      <Text style={styles.ctaText}>Create activity</Text>
      <Ionicons name="arrow-forward" size={18} color={colors.primaryText} />
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  heading: { color: colors.text, fontSize: 30, lineHeight: 38, fontWeight: '900', letterSpacing: -0.8, textAlign: 'center', marginTop: 24, marginBottom: 12 },
  support: { color: colors.textMuted, fontSize: 15, lineHeight: 24, textAlign: 'center', maxWidth: 320 },
  cta: { marginTop: 30, minHeight: 52, paddingHorizontal: 26, borderRadius: 999, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  ctaText: { color: colors.primaryText, fontSize: 15, fontWeight: '900' },
});
