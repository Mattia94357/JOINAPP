import React from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

export default function ParticipantStepper({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const count = Number(value);
  const decrease = () => { if (count > 2) onChange(String(count - 1)); };
  const increase = () => onChange(String(count + 1));
  return <View style={styles.container}>
    <Text style={styles.label}>Group size</Text><Text style={styles.hint}>Including you</Text>
    <View style={styles.controls} accessibilityRole={Platform.OS === 'web' ? undefined : 'adjustable'} accessibilityLabel="Max participants" accessibilityValue={{ min: 2, now: count, text: `${value} participants` }} onAccessibilityAction={event => { if (event.nativeEvent.actionName === 'increment') increase(); else if (event.nativeEvent.actionName === 'decrement') decrease(); }} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Decrease participants" accessibilityState={{ disabled: count <= 2 }} disabled={count <= 2} style={[styles.button, count <= 2 && styles.disabled]} onPress={decrease}><Ionicons name="remove" size={25} color={colors.text} /></TouchableOpacity>
      <View style={styles.count}><Text style={styles.number}>{value}</Text><Text style={styles.hint}>participants</Text></View>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Increase participants" style={styles.button} onPress={increase}><Ionicons name="add" size={25} color={colors.text} /></TouchableOpacity>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  container: { backgroundColor: colors.surfaceSoft, borderRadius: 22, padding: 22, marginBottom: 22 }, label: { color: colors.text, fontSize: 20, fontWeight: '800' }, hint: { color: colors.textMuted, fontSize: 13, marginTop: 5 }, controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, gap: 12 }, button: { width: 54, height: 54, borderRadius: 27, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' }, count: { flex: 1, alignItems: 'center' }, number: { color: colors.text, fontSize: 44, fontWeight: '800', lineHeight: 52 }, disabled: { opacity: 0.3 },
});
