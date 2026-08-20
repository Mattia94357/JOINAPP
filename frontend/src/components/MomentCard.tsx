import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MomentResponse } from '../api';
import { colors, spacing } from '../theme';
import AvatarBadge from './AvatarBadge';

type Props = {
  moment: MomentResponse;
  busy?: boolean;
  onActivityPress?: (activityId: string) => void;
  onCreatorPress?: (userId: string) => void;
  onToggleLike?: (moment: MomentResponse) => void;
  onDelete?: (moment: MomentResponse) => void;
};

const formatDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function MomentCard({ moment, busy, onActivityPress, onCreatorPress, onToggleLike, onDelete }: Props) {
  const avatar = moment.creator.profileThumbnailUrl || moment.creator.profilePictureUrl || moment.creator.avatar;
  return (
    <View style={styles.card}>
      <View style={styles.activityHeader}>
        <View style={styles.activityMark}><Ionicons name="camera-outline" size={15} color={colors.primaryText} /></View>
        <View style={styles.activityCopy}>
          <Text style={styles.eyebrow}>MOMENT FROM</Text>
          <TouchableOpacity disabled={!moment.activity.id} onPress={() => moment.activity.id && onActivityPress?.(moment.activity.id)}>
            <Text style={styles.activityTitle}>{moment.activity.title}</Text>
          </TouchableOpacity>
          <Text style={styles.activityMeta}>{formatDate(moment.activity.date)}{moment.activity.location ? `  ·  ${moment.activity.location}` : ''}</Text>
        </View>
        {moment.activity.visibility === 'private' ? <Ionicons name="lock-closed" size={14} color={colors.textSubtle} /> : null}
      </View>

      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.gallery}>
        {moment.images.map((image, index) => (
          <Image key={`${moment.id}-${index}`} source={{ uri: image }} style={styles.image} resizeMode="cover" />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.creator}
          disabled={!moment.creator.id}
          onPress={() => moment.creator.id && onCreatorPress?.(moment.creator.id)}
        >
          <AvatarBadge name={moment.creator.name} avatarUrl={avatar} size={34} />
          <View style={styles.creatorCopy}>
            <Text style={styles.joinedLabel}>Experienced by</Text>
            <Text style={styles.creatorName}>{moment.creator.name}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.likeButton}
          disabled={busy || !onToggleLike}
          onPress={() => onToggleLike?.(moment)}
          accessibilityLabel={`${moment.likedByViewer ? 'Unlike' : 'Like'} Moment`}
        >
          {busy ? <ActivityIndicator size="small" color={colors.primary} /> : (
            <Ionicons name={moment.likedByViewer ? 'heart' : 'heart-outline'} size={21} color={moment.likedByViewer ? colors.primary : colors.text} />
          )}
          <Text style={styles.likeCount}>{moment.likeCount}</Text>
        </TouchableOpacity>
      </View>

      {moment.caption ? <Text style={styles.caption}>{moment.caption}</Text> : null}
      {moment.canDelete && onDelete ? (
        <TouchableOpacity style={styles.deleteButton} disabled={busy} onPress={() => onDelete(moment)}>
          <Ionicons name="trash-outline" size={14} color={colors.textSubtle} />
          <Text style={styles.deleteText}>Delete Moment</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden', borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, marginBottom: spacing.md },
  activityHeader: { minHeight: 72, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  activityMark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  activityCopy: { flex: 1, marginLeft: spacing.sm },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  activityTitle: { color: colors.text, fontSize: 16, fontWeight: '900', marginTop: 2 },
  activityMeta: { color: colors.textSubtle, fontSize: 11, marginTop: 3 },
  gallery: { width: '100%', backgroundColor: colors.surfaceElevated },
  image: { width: 430, maxWidth: '100%' as any, aspectRatio: 1.12, backgroundColor: colors.surfaceElevated },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, paddingTop: spacing.md },
  creator: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  creatorCopy: { marginLeft: spacing.sm },
  joinedLabel: { color: colors.textSubtle, fontSize: 10, fontWeight: '700' },
  creatorName: { color: colors.text, fontSize: 13, fontWeight: '900' },
  likeButton: { minWidth: 58, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.border },
  likeCount: { color: colors.text, fontSize: 12, fontWeight: '900', marginLeft: 5 },
  caption: { color: colors.textMuted, fontSize: 13, lineHeight: 19, paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  deleteButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', padding: spacing.md },
  deleteText: { color: colors.textSubtle, fontSize: 11, fontWeight: '800', marginLeft: 5 },
});
