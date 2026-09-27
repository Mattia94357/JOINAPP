import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';

export const activityTimeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? 30 : 0;
  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const label = new Date(2020, 0, 1, hour, minute).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return { value, label };
});

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const parseDateKey = (value?: string) => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : undefined;
};

export const formatActivityDate = (value: string) => parseDateKey(value)?.toLocaleDateString([], {
  weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
}) || 'Choose a date';

type DateSelectorProps = { value: string; onChange: (value: string) => void };

export function ActivityDateSelector({ value, onChange }: DateSelectorProps) {
  const initial = parseDateKey(value) || new Date();
  const [visible, setVisible] = useState(false);
  const [month, setMonth] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cells = useMemo(() => {
    const leading = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: days }, (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1))];
  }, [month]);
  const mayGoBack = new Date(month.getFullYear(), month.getMonth() + 1, 0) >= today;

  return <>
    <TouchableOpacity style={styles.selector} onPress={() => setVisible(true)} accessibilityRole="button" accessibilityLabel="Choose activity date">
      <Text style={[styles.selectorText, !value && styles.placeholder]}>{formatActivityDate(value)}</Text>
      <Ionicons name="calendar-outline" size={19} color={colors.primary} />
    </TouchableOpacity>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          <View style={styles.monthHeader}>
            <TouchableOpacity disabled={!mayGoBack} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={24} color={mayGoBack ? colors.text : colors.textSubtle} /></TouchableOpacity>
            <Text style={styles.modalTitle}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</Text>
            <TouchableOpacity onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          <View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <Text key={`${day}-${i}`} style={styles.weekDay}>{day}</Text>)}</View>
          <View style={styles.calendarGrid}>{cells.map((day, index) => {
            if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
            const disabled = day < today;
            const selected = dateKey(day) === value;
            return <TouchableOpacity key={dateKey(day)} style={[styles.dayCell, selected && styles.daySelected]} disabled={disabled} onPress={() => { onChange(dateKey(day)); setVisible(false); }}>
              <Text style={[styles.dayText, disabled && styles.dayDisabled, selected && styles.daySelectedText]}>{day.getDate()}</Text>
            </TouchableOpacity>;
          })}</View>
          <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  </>;
}

type TimeSelectorProps = { value: string; onChange: (value: string) => void; optional?: boolean; label: string };

export function ActivityTimeSelector({ value, onChange, optional, label }: TimeSelectorProps) {
  const [visible, setVisible] = useState(false);
  const selectedLabel = activityTimeOptions.find((option) => option.value === value)?.label;
  return <>
    <TouchableOpacity style={styles.selector} onPress={() => setVisible(true)} accessibilityRole="button" accessibilityLabel={`Choose ${label.toLowerCase()}`}>
      <Text style={[styles.selectorText, !value && styles.placeholder]}>{selectedLabel || (optional ? 'No end time' : 'Choose time')}</Text>
      <Ionicons name="time-outline" size={19} color={colors.primary} />
    </TouchableOpacity>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.backdrop}><View style={styles.timeCard}>
        <Text style={styles.modalTitle}>{label}</Text>
        <ScrollView>{optional ? <TouchableOpacity style={styles.timeOption} onPress={() => { onChange(''); setVisible(false); }}><Text style={styles.timeText}>No end time</Text></TouchableOpacity> : null}
          {activityTimeOptions.map((option) => <TouchableOpacity key={option.value} style={[styles.timeOption, value === option.value && styles.timeSelected]} onPress={() => { onChange(option.value); setVisible(false); }}><Text style={[styles.timeText, value === option.value && styles.timeSelectedText]}>{option.label}</Text></TouchableOpacity>)}
        </ScrollView>
        <TouchableOpacity style={styles.closeButton} onPress={() => setVisible(false)}><Text style={styles.closeText}>Close</Text></TouchableOpacity>
      </View></View>
    </Modal>
  </>;
}

const styles = StyleSheet.create({
  selector: { minHeight: 50, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectorText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  placeholder: { color: colors.textSubtle, fontWeight: '500' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.76)', justifyContent: 'center', padding: spacing.lg },
  modalCard: { backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: spacing.md },
  timeCard: { backgroundColor: colors.surfaceElevated, borderRadius: 18, padding: spacing.md, maxHeight: '78%' },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '900', textAlign: 'center', marginBottom: spacing.sm },
  weekRow: { flexDirection: 'row' },
  weekDay: { width: '14.285%', color: colors.textSubtle, textAlign: 'center', fontSize: 11, fontWeight: '900' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm },
  dayCell: { width: '14.285%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 },
  daySelected: { backgroundColor: colors.primary },
  dayText: { color: colors.text, fontWeight: '800' },
  dayDisabled: { color: colors.textSubtle, opacity: 0.35 },
  daySelectedText: { color: colors.primaryText },
  timeOption: { minHeight: 46, justifyContent: 'center', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  timeSelected: { backgroundColor: colors.goldWash },
  timeText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  timeSelectedText: { color: colors.primary, fontWeight: '900' },
  closeButton: { alignItems: 'center', paddingTop: spacing.md },
  closeText: { color: colors.primary, fontWeight: '900' },
});
