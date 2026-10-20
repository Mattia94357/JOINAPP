import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleProp, StyleSheet, Text, TextInput, TextInputProps, TouchableOpacity, View, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// React Native Web 0.18 uses individual accessibility props instead of the native state object.
export function webAccessibilityState(state: { checked?: boolean; selected?: boolean; expanded?: boolean; busy?: boolean }) {
  return Platform.OS === 'web' ? { accessibilityChecked: state.checked, accessibilitySelected: state.selected, accessibilityExpanded: state.expanded, accessibilityBusy: state.busy } as any : {};
}

/** Shared only by Profile Edit and the activity creation controls. */
export function SoftTextInput({ style, onFocus, onBlur, multiline, ...props }: TextInputProps) {
  const [focused, setFocused] = useState(false);
  return <TextInput {...props} multiline={multiline} placeholderTextColor={props.placeholderTextColor || colors.textSubtle}
    style={[styles.input, multiline && styles.multiline, Platform.OS === 'web' && { outlineStyle: 'none' } as any, style, focused && styles.inputFocused]}
    onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }} />;
}

type SelectorRowProps = {
  label: string; value?: string; icon?: IconName; onPress: () => void;
  accessibilityLabel?: string; hint?: string; disabled?: boolean; expanded?: boolean;
  children?: React.ReactNode;
};
export function SelectorRow({ label, value, icon, onPress, accessibilityLabel, hint, disabled, expanded, children }: SelectorRowProps) {
  const [focused, setFocused] = useState(false);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={accessibilityLabel || label} accessibilityHint={hint}
    accessibilityState={{ disabled: Boolean(disabled), expanded }} {...webAccessibilityState({ expanded })} disabled={disabled} activeOpacity={0.8}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    style={[styles.row, focused && styles.focused, disabled && styles.disabled]}>
    {icon && <View style={styles.rowIcon}><Ionicons name={icon} size={22} color={colors.primary} /></View>}
    <View style={styles.grow}><Text style={styles.rowLabel}>{label}</Text>{value ? <Text style={styles.rowValue}>{value}</Text> : null}{children}</View>
    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
  </TouchableOpacity>;
}

export function SelectionTags({ values }: { values: readonly string[] }) {
  return <View style={styles.tags}>{values.map((value, index) => <View style={styles.tag} key={`${value}-${index}`}><Text style={styles.tagText}>{value}</Text></View>)}</View>;
}

type ChoiceCardProps = { label: string; description?: string; selected: boolean; onPress: () => void; style?: StyleProp<ViewStyle>; disabled?: boolean };
export function ChoiceCard({ label, description, selected, onPress, style, disabled }: ChoiceCardProps) {
  const [focused, setFocused] = useState(false);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected, disabled: Boolean(disabled) }} {...webAccessibilityState({ selected })}
    disabled={disabled} onPress={onPress} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
    style={[styles.choice, selected && styles.choiceSelected, focused && styles.focused, style]}>
    <View style={styles.choiceHeader}><Text style={styles.choiceLabel}>{label}</Text><Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.primary : colors.textSubtle} /></View>
    {description ? <Text style={styles.choiceDescription}>{description}</Text> : null}
  </TouchableOpacity>;
}

type SheetProps = { visible: boolean; title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode };
export function CinematicSheet({ visible, title, subtitle, onClose, children, footer }: SheetProps) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.backdrop}>
        <TouchableOpacity accessible={false} {...(Platform.OS === 'web' ? { focusable: false } as any : {})} activeOpacity={1} style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.handle} />
          <View style={styles.sheetHeader}><Text accessibilityRole="header" style={styles.sheetTitle}>{title}</Text>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Close ${title.toLowerCase()} selector`} onPress={onClose} style={styles.close}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
          </View>
          {subtitle ? <Text style={styles.sheetSubtitle}>{subtitle}</Text> : null}
          {children}
          {footer ? <View style={styles.sheetFooter}>{footer}</View> : null}
        </SafeAreaView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function SheetDoneButton({ onPress, label = 'Done' }: { onPress: () => void; label?: string }) {
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={label} style={styles.done} onPress={onPress}><Text style={styles.doneText}>{label}</Text><Ionicons name="checkmark" size={19} color={colors.primaryText} /></TouchableOpacity>;
}

export type SelectionOption = { label: string; value: string };
type SelectionSheetProps = {
  visible: boolean; title: string; options: readonly SelectionOption[]; selected: readonly string[];
  onConfirm: (values: string[]) => void; onClose: () => void;
  multiple?: boolean; searchable?: boolean; allowCustom?: boolean; maxSelections?: number;
};
export function SelectionSheet({ visible, title, options, selected, onConfirm, onClose, multiple, searchable, allowCustom, maxSelections }: SelectionSheetProps) {
  const [draft, setDraft] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  useEffect(() => {
    // Opening starts a selection draft; dismissing never commits pending choices.
    if (visible) { setDraft([...selected]); setQuery(''); }
  }, [visible]);
  const allOptions = [...options];
  for (const value of [...selected, ...draft]) if (!allOptions.some(option => option.value === value)) allOptions.push({ label: value, value });
  const search = query.trim();
  const filtered = allOptions.filter(option => option.label.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const canAdd = allowCustom && search && !allOptions.some(option => option.label.toLocaleLowerCase() === search.toLocaleLowerCase());
  const toggle = (value: string) => {
    if (!multiple) { setDraft([value]); return; }
    setDraft(current => current.includes(value) ? current.filter(item => item !== value) : maxSelections && current.length >= maxSelections ? current : [...current, value]);
  };
  const optionRow = (option: SelectionOption, custom = false) => {
    const checked = draft.includes(option.value);
    const disabled = Boolean(multiple && !checked && maxSelections && draft.length >= maxSelections);
    return <TouchableOpacity key={option.value} accessibilityRole={multiple ? 'checkbox' : 'radio'} accessibilityLabel={custom ? `Add ${option.label}` : option.label}
      accessibilityState={{ checked, disabled }} {...webAccessibilityState({ checked })} disabled={disabled} onPress={() => { toggle(option.value); if (custom) setQuery(''); }}
      style={[styles.option, checked && styles.optionSelected, disabled && styles.disabled]}>
      <Text style={styles.optionLabel}>{custom ? `Add ${option.label}` : option.label}</Text>
      <Ionicons name={checked ? 'checkmark-circle' : multiple ? 'ellipse-outline' : 'radio-button-off'} size={23} color={checked ? colors.primary : colors.textMuted} />
    </TouchableOpacity>;
  };
  return <CinematicSheet visible={visible} title={title} subtitle={multiple ? `Choose what fits you${maxSelections ? ` · up to ${maxSelections}` : ''}.` : 'Choose one option.'} onClose={onClose}
    footer={<SheetDoneButton label="Done" onPress={() => { onConfirm(draft); onClose(); }} />}>
    {searchable && <SoftTextInput accessibilityLabel={`Search ${title.toLowerCase()}`} value={query} onChangeText={setQuery} placeholder={`Search ${title.toLowerCase()}`} autoCorrect={false} autoCapitalize="none" style={styles.search} />}
    <ScrollView style={styles.list} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.listContent}>
      {multiple && draft.length > 0 ? <View accessibilityLabel="Selected options"><SelectionTags values={draft.map(value => allOptions.find(option => option.value === value)?.label || value)} /></View> : null}
      {filtered.map(option => optionRow(option))}
      {canAdd ? optionRow({ label: search, value: search }, true) : null}
      {!filtered.length && !canAdd ? <Text style={styles.noResults}>No matching options.</Text> : null}
    </ScrollView>
  </CinematicSheet>;
}

const styles = StyleSheet.create({
  grow: { flex: 1 }, disabled: { opacity: 0.4 },
  input: { color: colors.text, backgroundColor: colors.surfaceSoft, borderRadius: 20, padding: 18, minHeight: 60, fontSize: 17, lineHeight: 25, borderWidth: 1, borderColor: 'transparent' },
  multiline: { minHeight: 160, textAlignVertical: 'top' }, inputFocused: { borderColor: colors.primary, borderBottomColor: colors.primary },
  row: { minHeight: 88, borderRadius: 20, backgroundColor: colors.surfaceSoft, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderColor: 'transparent' },
  focused: { borderColor: colors.primary }, rowIcon: { width: 30, alignItems: 'center' }, rowLabel: { color: colors.text, fontSize: 19, fontWeight: '800', lineHeight: 26 }, rowValue: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: 5 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 10, marginBottom: 4 }, tag: { borderRadius: 999, backgroundColor: colors.surfaceElevated, paddingHorizontal: 12, paddingVertical: 7 }, tagText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  choice: { minHeight: 90, borderRadius: 20, backgroundColor: colors.surfaceSoft, padding: 20, borderWidth: 1, borderColor: 'transparent' }, choiceSelected: { backgroundColor: colors.goldWash, borderColor: colors.goldBorder }, choiceHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, choiceLabel: { color: colors.text, fontSize: 18, fontWeight: '800', flex: 1 }, choiceDescription: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginTop: 12 },
  overlay: { flex: 1 }, backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 600, maxHeight: '90%', flexShrink: 1, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#151515' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, alignSelf: 'center', marginBottom: 14 }, sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 }, sheetTitle: { color: colors.text, fontSize: 28, lineHeight: 35, fontWeight: '900', flex: 1, letterSpacing: -0.7 }, close: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  sheetSubtitle: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 18 }, sheetFooter: { paddingVertical: 18 }, done: { minHeight: 54, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10 }, doneText: { color: colors.primaryText, fontSize: 15, fontWeight: '900' },
  list: { flexShrink: 1 }, listContent: { paddingBottom: 12 }, search: { backgroundColor: colors.surfaceElevated, marginBottom: 12 }, option: { minHeight: 62, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 5 }, optionSelected: { backgroundColor: colors.goldWash }, optionLabel: { color: colors.text, fontSize: 17, lineHeight: 24, flex: 1 }, noResults: { color: colors.textMuted, paddingVertical: 24, textAlign: 'center' },
});
