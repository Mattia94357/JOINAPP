import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AvatarBadge from './AvatarBadge';
import { colors, spacing } from '../theme';

export type ParticipantSummary = {
  id?: string;
  name: string;
  avatar?: string;
  profilePictureUrl?: string;
  profileThumbnailUrl?: string;
};

type Props = {
  visible: boolean;
  participants: ParticipantSummary[];
  onClose: () => void;
  onOpenProfile: (participant: ParticipantSummary) => void;
  hostId?: string;
  canManage?: boolean;
  removingParticipantId?: string;
  onRemoveParticipant?: (participant: ParticipantSummary) => void;
};

export default function ParticipantsModal({
  visible, participants, onClose, onOpenProfile, hostId, canManage = false,
  removingParticipantId, onRemoveParticipant,
}: Props) {
  const [query, setQuery] = useState('');
  const visibleParticipants = useMemo(
    () => participants.filter((participant) => participant.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 50),
    [participants, query],
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>{participants.length} Participants</Text>
              <Text style={styles.subtitle}>Tap anyone to view their public profile</Text>
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close-outline" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder="Search participants"
            placeholderTextColor={colors.textSubtle}
          />

          <ScrollView contentContainerStyle={styles.grid}>
            {visibleParticipants.map((participant, index) => {
              const image = participant.profileThumbnailUrl || participant.profilePictureUrl || participant.avatar;
              return (
                <View key={`${participant.name}-${participant.id || index}`} style={styles.person}>
                  <TouchableOpacity style={styles.profileButton} onPress={() => onOpenProfile(participant)}>
                    <AvatarBadge name={participant.name} avatarUrl={image} size={64} />
                    <Text style={styles.name} numberOfLines={1}>{participant.name}</Text>
                  </TouchableOpacity>
                  {canManage && participant.id && participant.id !== hostId && onRemoveParticipant ? (
                    <TouchableOpacity
                      style={[styles.removeButton, removingParticipantId === participant.id && styles.removeButtonBusy]}
                      disabled={Boolean(removingParticipantId)}
                      onPress={() => onRemoveParticipant(participant)}
                    >
                      {removingParticipantId === participant.id
                        ? <ActivityIndicator size="small" color={colors.danger} />
                        : <Text style={styles.removeText}>Remove</Text>}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.62)',
    justifyContent: Platform.OS === 'web' ? 'center' : 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: Platform.OS === 'web' ? '92%' : '100%',
    maxWidth: 460,
    maxHeight: '84%',
    backgroundColor: colors.background,
    borderRadius: Platform.OS === 'web' ? 16 : 0,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.xs,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  search: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    color: colors.text,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  person: {
    width: '30%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  profileButton: {
    width: '100%',
    alignItems: 'center',
  },
  name: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  removeButton: {
    minHeight: 32,
    marginTop: spacing.sm,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonBusy: { opacity: 0.65 },
  removeText: { color: colors.danger, fontSize: 12, fontWeight: '800' },
});
