import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { BlockedUser, fetchBlockedUsersRequest, unblockUserRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import AvatarBadge from '../components/AvatarBadge';
import { colors, spacing } from '../theme';

export default function BlockedUsersScreen() {
  const { token } = useAuth();
  const [users, setUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmId, setConfirmId] = useState<string>();
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { if (token) setUsers((await fetchBlockedUsersRequest(token)).data); }
    catch { setError('Unable to load blocked users. Tap to retry.'); }
    finally { setLoading(false); }
  }, [token]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const unblock = async (id: string) => {
    if (!token || busy) return;
    setBusy(true); setError('');
    try { await unblockUserRequest(id, token); setUsers((current) => current.filter((user) => user.id !== id)); setConfirmId(undefined); }
    catch { setError('Unable to unblock this user. Please try again.'); }
    finally { setBusy(false); }
  };
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.title}>Blocked users</Text>
    <Text style={styles.text}>Unblocking restores interaction unless the other person has also blocked you.</Text>
    {loading ? <ActivityIndicator color={colors.primary} /> : null}
    {error ? <TouchableOpacity onPress={load}><Text accessibilityRole="alert" style={styles.error}>{error}</Text></TouchableOpacity> : null}
    {!loading && !error && !users.length ? <Text style={styles.empty}>No blocked users.</Text> : null}
    {users.map((user) => <View key={user.id} style={styles.row}>
      <AvatarBadge name={user.name} avatarUrl={user.avatar} size={40} />
      <View style={styles.copy}><Text style={styles.name}>{user.name}</Text>
        {confirmId === user.id ? <>
          <Text style={styles.text}>Unblock {user.name}?</Text>
          <TouchableOpacity disabled={busy} accessibilityLabel={`Confirm unblock ${user.name}`} onPress={() => unblock(user.id)}><Text style={styles.action}>{busy ? 'Unblocking...' : 'Confirm unblock'}</Text></TouchableOpacity>
          <TouchableOpacity disabled={busy} onPress={() => setConfirmId(undefined)}><Text style={styles.action}>Cancel</Text></TouchableOpacity>
        </> : <TouchableOpacity disabled={busy} accessibilityLabel={`Unblock ${user.name}`} onPress={() => setConfirmId(user.id)}><Text style={styles.action}>Unblock</Text></TouchableOpacity>}
      </View>
    </View>)}
  </ScrollView>;
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, content: { padding: spacing.lg, width: '100%', maxWidth: 500, alignSelf: 'center' },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', marginBottom: spacing.md }, text: { color: colors.textMuted, lineHeight: 21 },
  empty: { color: colors.textMuted, paddingVertical: spacing.lg }, row: { flexDirection: 'row', paddingVertical: spacing.md, borderBottomWidth: 1, borderColor: colors.border },
  copy: { flex: 1, marginLeft: spacing.md }, name: { color: colors.text, fontWeight: '800' }, action: { color: colors.primary, paddingVertical: spacing.sm, fontWeight: '800' }, error: { color: colors.danger, paddingVertical: spacing.md },
});
