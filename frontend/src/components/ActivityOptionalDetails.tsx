import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ActivityAgeGroup, ageGroupOptions } from '../utils/activityFilters';
import { CinematicSheet, ChoiceCard, SelectionSheet, SelectorRow, SheetDoneButton, SoftTextInput } from './CinematicControls';
import { colors } from '../theme';

type Props = {
  vibe: string; onVibeChange: (value: string) => void;
  ageGroup: ActivityAgeGroup; onAgeGroupChange: (value: ActivityAgeGroup) => void;
  costType: 'Free' | 'Paid'; onCostTypeChange: (value: 'Free' | 'Paid') => void;
  costAmount: string; onCostAmountChange: (value: string) => void;
  hostNote: string; onHostNoteChange: (value: string) => void;
  cancellationPolicy: string; onCancellationChange: (value: string) => void;
};
export default function ActivityOptionalDetails(props: Props) {
  const [active, setActive] = useState<'vibe' | 'age' | 'cost' | 'host' | 'cancellation' | null>(null);
  const [textDraft, setTextDraft] = useState('');
  const [costDraft, setCostDraft] = useState<'Free' | 'Paid'>('Free');
  const openText = (field: 'cost' | 'host' | 'cancellation') => {
    setTextDraft(field === 'cost' ? props.costAmount : field === 'host' ? props.hostNote : props.cancellationPolicy);
    setCostDraft(props.costType); setActive(field);
  };
  const close = () => setActive(null);
  const saveText = () => {
    if (active === 'cost') { props.onCostTypeChange(costDraft); props.onCostAmountChange(textDraft); }
    if (active === 'host') props.onHostNoteChange(textDraft);
    if (active === 'cancellation') props.onCancellationChange(textDraft);
    close();
  };
  return <View>
    <SelectorRow label="Vibe" value={props.vibe} icon="heart-outline" onPress={() => setActive('vibe')} />
    <SelectorRow label="Intended age group" value={ageGroupOptions.find(option => option.value === props.ageGroup)?.label} icon="people-outline" onPress={() => setActive('age')} />
    <SelectorRow label="Cost" value={props.costType === 'Paid' ? `AUD ${props.costAmount || '—'}` : 'Free'} icon="card-outline" onPress={() => openText('cost')} />
    <SelectorRow label="Host note" value={props.hostNote || 'Optional arrival or bring-along details'} icon="chatbubble-outline" onPress={() => openText('host')} />
    <SelectorRow label="Cancellation note" value={props.cancellationPolicy || 'Optional weather or cancellation details'} icon="document-text-outline" onPress={() => openText('cancellation')} />
    <SelectionSheet visible={active === 'vibe'} title="Vibe" options={['Laid-back', 'Social', 'Creative', 'Active'].map(value => ({ label: value, value }))} selected={[props.vibe]} onConfirm={values => { if (values[0]) props.onVibeChange(values[0]); }} onClose={close} />
    <SelectionSheet visible={active === 'age'} title="Intended age group" options={ageGroupOptions} selected={[props.ageGroup]} onConfirm={values => { if (values[0]) props.onAgeGroupChange(values[0] as ActivityAgeGroup); }} onClose={close} />
    <CinematicSheet visible={active === 'cost' || active === 'host' || active === 'cancellation'} title={active === 'cost' ? 'Cost' : active === 'host' ? 'Host note' : 'Cancellation note'} onClose={close}
      subtitle={active === 'cost' ? 'Keep it free, or share the cost in AUD.' : 'A little extra context, only if it helps.'} footer={<SheetDoneButton onPress={saveText} />}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetBody}>
        {active === 'cost' ? <>
          <View style={styles.costChoices}>{(['Free', 'Paid'] as const).map(value => <ChoiceCard key={value} label={value} selected={costDraft === value} onPress={() => setCostDraft(value)} style={styles.costChoice} />)}</View>
          {costDraft === 'Paid' && <><Text style={styles.label}>Amount in AUD</Text><SoftTextInput accessibilityLabel="Cost in AUD" keyboardType="decimal-pad" value={textDraft} onChangeText={setTextDraft} placeholder="e.g. 15" /></>}
        </> : <SoftTextInput accessibilityLabel={active === 'host' ? 'Host note' : 'Cancellation note'} value={textDraft} onChangeText={setTextDraft} multiline placeholder="Add a note (optional)" />}
      </ScrollView>
    </CinematicSheet>
  </View>;
}
const styles = StyleSheet.create({ sheetBody: { paddingBottom: 12 }, costChoices: { flexDirection: 'row', gap: 12 }, costChoice: { flex: 1 }, label: { color: colors.textMuted, fontSize: 14, marginTop: 20, marginBottom: 12 } });
