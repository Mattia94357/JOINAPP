import React, { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { ReportTargetType, submitReportRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';

const reasons = ['Spam', 'Harassment', 'Hate or discrimination', 'Unsafe behavior', 'Inappropriate content', 'Other'];
export default function ReportButton({ targetType, targetId, label }: { targetType: ReportTargetType; targetId: string; label: string }) {
  const { token } = useAuth();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async () => {
    if (!token || !reason || busy) return;
    setBusy(true); setError('');
    try { await submitReportRequest(targetType, targetId, reason, detail, token); setSent(true); }
    catch (failure: any) { setError(failure?.response?.data?.message || 'Unable to send report. Please try again.'); }
    finally { setBusy(false); }
  };
  return <>
    <TouchableOpacity accessibilityLabel={label} style={styles.action} onPress={() => {
      setReason(''); setDetail(''); setError(''); setSent(false); setVisible(true);
    }}><Text style={styles.actionText}>{label}</Text></TouchableOpacity>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => !busy && setVisible(false)}>
      <View style={styles.backdrop}><ScrollView style={styles.dialog} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{sent ? 'Report submitted' : label}</Text>
        {sent ? <Text style={styles.text}>Thanks for helping keep JOIN safe. Reports are private.</Text>
          : !token ? <Text style={styles.text}>Sign in to submit a report.</Text> : <>
            <Text style={styles.text}>Choose a reason. The reported person cannot see your report.</Text>
            {reasons.map((value) => <TouchableOpacity key={value} disabled={busy} accessibilityRole="radio"
              accessibilityState={{ checked: reason === value }} onPress={() => setReason(value)} style={[styles.reason, reason === value && styles.selected]}>
              <Text style={styles.text}>{value}</Text>
            </TouchableOpacity>)}
            <TextInput accessibilityLabel="Report details" placeholder="Additional details (optional)" placeholderTextColor={colors.textSubtle}
              multiline maxLength={1000} value={detail} onChangeText={setDetail} editable={!busy} style={styles.input} />
            <Text style={styles.text}>{detail.length}/1000</Text>
            {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
            <TouchableOpacity accessibilityLabel="Submit report" disabled={!reason || busy} onPress={submit} style={[styles.reason, (!reason || busy) && { opacity: .4 }]}>
              <Text style={styles.actionText}>{busy ? 'Submitting...' : 'Submit report'}</Text>
            </TouchableOpacity>
          </>}
        <TouchableOpacity disabled={busy} accessibilityLabel="Close report" style={styles.action} onPress={() => setVisible(false)}><Text style={styles.text}>Close</Text></TouchableOpacity>
      </ScrollView></View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  action: { padding: spacing.sm }, actionText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,.7)', alignItems: 'center', justifyContent: 'center', padding: spacing.md },
  dialog: { width: '100%', maxWidth: 440, maxHeight: '90%', backgroundColor: colors.surface, borderRadius: 16 },
  content: { padding: spacing.lg }, title: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: spacing.md },
  text: { color: colors.textMuted, fontSize: 14 }, reason: { padding: spacing.md, marginTop: spacing.sm, borderRadius: 12, borderWidth: 1, borderColor: colors.border },
  selected: { borderColor: colors.primary, backgroundColor: colors.goldWash },
  input: { minHeight: 80, color: colors.text, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: spacing.md, marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.sm },
});
