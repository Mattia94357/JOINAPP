import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { CinematicSheet, SelectorRow, SheetDoneButton, webAccessibilityState } from './CinematicControls';

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
  const close = () => setVisible(false);
  return <>
    <SelectorRow label="Date" value={formatActivityDate(value)} icon="calendar-outline" onPress={() => setVisible(true)} expanded={visible} accessibilityLabel="Choose activity date" />
    <CinematicSheet title="Choose a date" visible={visible} onClose={close} subtitle="Make a little time for something good." footer={<SheetDoneButton label="Close" onPress={close} />}>
      <ScrollView style={styles.list}>
        <View style={styles.monthHeader}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Previous month" style={styles.monthButton} disabled={!mayGoBack} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={24} color={mayGoBack ? colors.text : colors.textSubtle} /></TouchableOpacity>
          <Text style={styles.monthTitle}>{month.toLocaleDateString([], { month: 'long', year: 'numeric' })}</Text>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Next month" style={styles.monthButton} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={24} color={colors.text} /></TouchableOpacity>
        </View>
        <View style={styles.weekRow}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <Text key={`${day}-${i}`} style={styles.weekDay}>{day}</Text>)}</View>
        <View style={styles.calendarGrid}>{cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.dayCell} />;
          const disabled = day < today;
          const selected = dateKey(day) === value;
          return <TouchableOpacity key={dateKey(day)} style={[styles.dayCell, selected && styles.daySelected]} accessibilityRole="button" accessibilityLabel={day.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} accessibilityState={{ selected, disabled }} {...webAccessibilityState({ selected })} hitSlop={2} disabled={disabled} onPress={() => { onChange(dateKey(day)); close(); }}>
            <Text style={[styles.dayText, disabled && styles.dayDisabled, selected && styles.daySelectedText]}>{day.getDate()}</Text>
          </TouchableOpacity>;
        })}</View>
      </ScrollView>
    </CinematicSheet>
  </>;
}

type TimeSelectorProps = { value: string; onChange: (value: string) => void; optional?: boolean; label: string };
export function ActivityTimeSelector({ value, onChange, optional, label }: TimeSelectorProps) {
  const [visible, setVisible] = useState(false);
  const selectedLabel = activityTimeOptions.find(option => option.value === value)?.label;
  const close = () => setVisible(false);
  const choose = (next: string) => { onChange(next); close(); };
  const row = (next: string, title: string) => <TouchableOpacity key={next} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ selected: value === next }} {...webAccessibilityState({ selected: value === next })}
    style={[styles.timeOption, value === next && styles.timeSelected]} onPress={() => choose(next)}>
    <Text style={[styles.timeText, value === next && styles.timeSelectedText]}>{title}</Text>
    {value === next ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
  </TouchableOpacity>;
  return <>
    <SelectorRow label={label} value={selectedLabel || (optional ? 'No end time' : 'Choose time')} icon="time-outline" expanded={visible} onPress={() => setVisible(true)} accessibilityLabel={`Choose ${label.toLowerCase()}`} />
    <CinematicSheet visible={visible} title={label} subtitle="Choose a time in 30-minute intervals." onClose={close} footer={<SheetDoneButton label="Close" onPress={close} />}>
      <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.timeList}>
        {optional ? row('', 'No end time') : null}
        {activityTimeOptions.map(option => row(option.value, option.label))}
      </ScrollView>
    </CinematicSheet>
  </>;
}

const styles = StyleSheet.create({
  list: { flexShrink: 1 }, monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }, monthButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, monthTitle: { color: colors.text, fontSize: 18, fontWeight: '800' },
  weekRow: { flexDirection: 'row', marginBottom: 10 }, weekDay: { width: '14.285%', color: colors.textMuted, textAlign: 'center', fontSize: 12, fontWeight: '700' }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingBottom: 12 },
  dayCell: { width: '14.285%', minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 24 }, daySelected: { backgroundColor: colors.primary }, dayText: { color: colors.text, fontSize: 16, fontWeight: '700' }, dayDisabled: { color: colors.textSubtle, opacity: 0.45 }, daySelectedText: { color: colors.primaryText },
  timeList: { paddingBottom: 10 }, timeOption: { minHeight: 64, paddingHorizontal: 20, paddingVertical: 18, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }, timeSelected: { backgroundColor: colors.goldWash }, timeText: { color: colors.text, fontSize: 19, fontWeight: '700' }, timeSelectedText: { color: colors.primary },
});
