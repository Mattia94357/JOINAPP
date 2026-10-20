import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { activityCategories } from '../utils/categories';
import { colors } from '../theme';
import { CinematicSheet, SelectionSheet, SelectionTags, SelectorRow, SheetDoneButton, SoftTextInput, webAccessibilityState } from './CinematicControls';

const languageOptions = ['English', 'Italian', 'Thai', 'Spanish', 'French', 'German', 'Portuguese', 'Mandarin', 'Cantonese', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Bengali', 'Punjabi', 'Urdu', 'Indonesian', 'Malay', 'Vietnamese', 'Filipino', 'Russian', 'Ukrainian', 'Polish', 'Dutch', 'Greek', 'Turkish', 'Swedish', 'Norwegian', 'Danish', 'Finnish', 'Czech', 'Hungarian', 'Romanian', 'Hebrew', 'Persian', 'Tamil', 'Telugu', 'Swahili', 'Afrikaans', 'Auslan'];
const splitValues = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);
type ProfileGender = 'male' | 'female' | 'non_binary' | 'prefer_not_to_say';
type Props = {
  aboutMe: string; onAboutMeChange: (value: string) => void;
  languagesText: string; onLanguagesChange: (value: string) => void;
  interestsText: string; onInterestsChange: (value: string) => void;
  instagram: string; onInstagramChange: (value: string) => void;
  ageRange: string; onAgeRangeChange: (value: string) => void;
  gender: ProfileGender; onGenderChange: (value: ProfileGender) => void;
  genderOptions: readonly { label: string; value: ProfileGender }[];
  saving: boolean; onSave: () => void; onCancel: () => void;
};
export default function ProfileDetailsEditor(props: Props) {
  const [selector, setSelector] = useState<'languages' | 'interests' | 'gender' | 'instagram' | 'age' | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const languages = splitValues(props.languagesText);
  const interests = splitValues(props.interestsText);
  const openText = (field: 'instagram' | 'age') => { setTextDraft(field === 'instagram' ? props.instagram : props.ageRange); setSelector(field); };
  const close = () => setSelector(null);
  return <View style={styles.editor}>
    <Text style={styles.sectionTitle}>A little about you</Text>
    <Text style={styles.hint}>Share what people should know before you meet.</Text>
    <SoftTextInput accessibilityLabel="About me" value={props.aboutMe} onChangeText={props.onAboutMeChange} editable={!props.saving} placeholder="What brings you here?" multiline />
    <Text style={styles.counter}>{props.aboutMe.length}/500</Text>
    <Text style={styles.sectionTitle}>Your details</Text>
    <Text style={styles.hint}>Tap a detail to make it yours.</Text>
    <SelectorRow label="Languages" icon="globe-outline" disabled={props.saving} value={!languages.length ? 'Choose the languages you speak' : undefined} expanded={selector === 'languages'} onPress={() => setSelector('languages')}>
      {languages.length ? <SelectionTags values={languages} /> : null}
    </SelectorRow>
    <SelectorRow label="Interests" icon="heart-outline" disabled={props.saving} value={!interests.length ? 'What do you enjoy?' : undefined} expanded={selector === 'interests'} onPress={() => setSelector('interests')}>
      {interests.length ? <SelectionTags values={interests} /> : null}
    </SelectorRow>
    <SelectorRow label="Gender" icon="person-outline" disabled={props.saving} value={props.genderOptions.find(option => option.value === props.gender)?.label} expanded={selector === 'gender'} onPress={() => setSelector('gender')} />
    <SelectorRow label="Instagram" icon="logo-instagram" disabled={props.saving} value={props.instagram || 'Optional'} onPress={() => openText('instagram')} />
    <SelectorRow label="Age range" icon="people-outline" disabled={props.saving} value={props.ageRange || 'Optional'} onPress={() => openText('age')} />
    <View style={styles.actions}>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel profile edits" disabled={props.saving} style={styles.cancel} onPress={props.onCancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Save profile" accessibilityState={{ busy: props.saving }} {...webAccessibilityState({ busy: props.saving })} disabled={props.saving} style={[styles.save, props.saving && styles.disabled]} onPress={props.onSave}><Text style={styles.saveText}>{props.saving ? 'Saving…' : 'Save'}</Text></TouchableOpacity>
    </View>
    <SelectionSheet title="Languages" visible={selector === 'languages'} options={languageOptions.map(value => ({ label: value, value }))} selected={languages} onConfirm={values => props.onLanguagesChange(values.join(', '))} onClose={close} multiple searchable allowCustom maxSelections={12} />
    <SelectionSheet title="Interests" visible={selector === 'interests'} options={activityCategories.map(value => ({ label: value, value }))} selected={interests} onConfirm={values => props.onInterestsChange(values.join(', '))} onClose={close} multiple searchable allowCustom maxSelections={20} />
    <SelectionSheet title="Gender" visible={selector === 'gender'} options={props.genderOptions} selected={[props.gender]} onConfirm={values => { const option = props.genderOptions.find(item => item.value === values[0]); if (option) props.onGenderChange(option.value); }} onClose={close} />
    <CinematicSheet title={selector === 'age' ? 'Age range' : 'Instagram'} visible={selector === 'age' || selector === 'instagram'} onClose={close} subtitle="Optional. Add it only if you want to share it."
      footer={<SheetDoneButton onPress={() => { if (selector === 'age') props.onAgeRangeChange(textDraft); else props.onInstagramChange(textDraft); close(); }} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.textSheet}>
        <SoftTextInput accessibilityLabel={selector === 'age' ? 'Age range' : 'Instagram'} value={textDraft} onChangeText={setTextDraft} placeholder={selector === 'age' ? 'e.g. 25-34' : '@yourname'} autoCapitalize="none" />
      </ScrollView>
    </CinematicSheet>
  </View>;
}

const styles = StyleSheet.create({
  editor: { paddingTop: 14 }, sectionTitle: { color: colors.text, fontSize: 23, lineHeight: 30, fontWeight: '800', letterSpacing: -0.6, marginTop: 24, marginBottom: 8 }, hint: { color: colors.textMuted, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  counter: { color: colors.textMuted, textAlign: 'right', fontSize: 12, marginTop: 9 }, actions: { flexDirection: 'row', gap: 18, marginTop: 22, marginBottom: 12 }, cancel: { minHeight: 54, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' }, cancelText: { color: colors.text, fontSize: 15, fontWeight: '700' }, save: { flex: 1, minHeight: 54, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }, saveText: { color: colors.primaryText, fontSize: 15, fontWeight: '900' }, disabled: { opacity: 0.5 }, textSheet: { paddingBottom: 12 },
});
