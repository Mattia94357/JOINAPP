import React, { useEffect, useState } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MomentResponse } from '../api';
import { colors, spacing } from '../theme';
import MomentCard from './MomentCard';
import MomentCommentsSection from './MomentCommentsSection';

type Props = {
  visible: boolean;
  moments: MomentResponse[];
  total: number;
  busyMomentId?: string;
  token?: string | null;
  initialCommentMomentId?: string;
  onClose: () => void;
  onActivityPress: (activityId: string) => void;
  onCreatorPress?: (userId: string) => void;
  onToggleLike?: (moment: MomentResponse) => void;
  onDeleteMoment?: (moment: MomentResponse) => void;
  onMomentUpdate: (momentId: string, update: Pick<MomentResponse, 'commentCount' | 'latestComments'>) => void;
};

export default function ProfileMomentsModal(props: Props) {
  const [commentMomentId, setCommentMomentId] = useState<string>();

  useEffect(() => {
    setCommentMomentId(props.visible ? props.initialCommentMomentId : undefined);
  }, [props.initialCommentMomentId, props.visible]);

  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.close} onPress={props.onClose} accessibilityLabel="Close Moments">
            <Ionicons name="arrow-back" size={21} color={colors.primary} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>REAL-WORLD HISTORY</Text>
            <Text style={styles.title}>Moments <Text style={styles.count}>({props.total})</Text></Text>
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {props.moments.map((moment) => (
            <React.Fragment key={moment.id}>
              <MomentCard
                moment={moment}
                busy={props.busyMomentId === moment.id}
                onActivityPress={(activityId) => { props.onClose(); props.onActivityPress(activityId); }}
                onCreatorPress={props.onCreatorPress}
                onToggleLike={props.onToggleLike}
                onCommentsPress={(selectedMoment) => setCommentMomentId((current) => current === selectedMoment.id ? undefined : selectedMoment.id)}
                onDelete={props.onDeleteMoment}
              />
              {commentMomentId === moment.id ? (
                <MomentCommentsSection
                  moment={moment}
                  token={props.token}
                  onMomentUpdate={props.onMomentUpdate}
                  onAuthorPress={props.onCreatorPress}
                />
              ) : null}
            </React.Fragment>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { width: '100%', maxWidth: 500, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: Platform.OS === 'web' ? ('calc(16px + env(safe-area-inset-top))' as any) : spacing.lg, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  close: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  headerCopy: { marginLeft: spacing.md },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 2 },
  count: { color: colors.textSubtle, fontSize: 15 },
  content: { width: '100%', maxWidth: 500, alignSelf: 'center', padding: spacing.md, paddingBottom: Platform.OS === 'web' ? ('calc(60px + env(safe-area-inset-bottom))' as any) : 60 },
});
