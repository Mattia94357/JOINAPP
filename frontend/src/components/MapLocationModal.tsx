import React from 'react';
import { ActivityIndicator, Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../theme';

export type MapLocationIssue = 'needed' | 'instructions' | 'permission-denied' | 'position-unavailable' | 'timeout' | 'unsupported' | 'insecure-context' | 'unknown';
type Props = { visible: boolean; issue: MapLocationIssue; granted: boolean; loading: boolean;
  onRequest: () => void; onInstructions: () => void; onDismiss: () => void };

export default function MapLocationModal({ visible, issue, granted, loading, onRequest, onInstructions, onDismiss }: Props) {
  const denied = issue === 'permission-denied';
  const instructions = issue === 'instructions';
  const unsupported = issue === 'unsupported' || issue === 'insecure-context';
  const title = denied ? 'Location access is off' : instructions ? 'Enable location access' : issue === 'needed' ? 'Location needed' : issue === 'timeout' ? 'Location timed out' : 'Location unavailable';
  const body = denied ? 'Enable location access in your browser or device settings to use your current location.'
    : instructions ? Platform.OS === 'web' ? "Open your browser's Website Settings and allow Location. On iPhone, also check Location Services for Safari Websites in Settings." : 'Open device Settings and allow JOIN to use your location, then return here.'
    : issue === 'needed' ? 'Allow location access to show activities near you.'
    : issue === 'timeout' ? 'Finding your location took too long. You can try again or keep browsing the map.'
    : issue === 'unsupported' ? 'This browser does not support location access. You can keep browsing the map.'
    : issue === 'insecure-context' ? 'Open JOIN over HTTPS to use your current location. You can keep browsing this map.'
    : 'Your device could not find your location. Check Location Services and try again.';
  const primary = denied ? 'Show instructions' : instructions ? "I've updated settings" : issue === 'needed' ? granted ? 'Use current location' : 'Allow location' : 'Try again';
  return <Modal visible={visible} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={onDismiss}>
    <View style={styles.backdrop}>
      <View style={styles.card} accessibilityViewIsModal accessibilityLabel="Location access" testID="map-location-modal">
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 18 }} /> : null}
        {!unsupported ? <TouchableOpacity style={[styles.primary, loading && { opacity: 0.55 }]} accessibilityRole="button"
          accessibilityLabel={primary} disabled={loading} onPress={denied ? onInstructions : onRequest}>
          <Text style={styles.primaryText}>{loading ? 'Finding location...' : primary}</Text>
        </TouchableOpacity> : null}
        <TouchableOpacity style={styles.secondary} accessibilityRole="button" accessibilityLabel={issue === 'needed' ? 'Not now' : 'Continue without location'} onPress={onDismiss}>
          <Text style={styles.secondaryText}>{issue === 'needed' ? 'Not now' : 'Continue without location'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(4,6,5,0.66)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, padding: 24, borderRadius: 24, backgroundColor: 'rgba(23,24,21,0.97)', borderWidth: 1, borderColor: colors.goldBorder,
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 12 },
  title: { color: colors.text, fontSize: 24, fontWeight: '900', lineHeight: 29 },
  body: { color: colors.textMuted, fontSize: 14, lineHeight: 21, marginTop: 12 },
  primary: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 22 },
  primaryText: { color: colors.primaryText, fontWeight: '900', fontSize: 14 },
  secondary: { paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  secondaryText: { color: colors.textMuted, fontSize: 13, fontWeight: '700' },
});
