import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MomentResponse } from '../api';
import { colors, spacing } from '../theme';

type Props = {
  moment?: MomentResponse;
  total: number;
  loading?: boolean;
  ownProfile?: boolean;
  busy?: boolean;
  onActivityPress: (activityId: string) => void;
  onToggleLike?: (moment: MomentResponse) => void;
  onViewAll: () => void;
};

const momentDate = (value?: string) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : date.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

export default function LatestMomentSection({ moment, total, loading, ownProfile, busy, onActivityPress, onToggleLike, onViewAll }: Props) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => setImageFailed(false), [moment?.id]);

  return (
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <View>
          <Text style={styles.eyebrow}>REAL EXPERIENCES</Text>
          <Text style={styles.heading}>Latest Moment</Text>
        </View>
        {moment?.activity.visibility === 'private' ? <Ionicons name="lock-closed" size={15} color={colors.textSubtle} /> : null}
      </View>

      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /></View> : null}
      {!loading && !moment ? (
        <View style={styles.empty}>
          <Ionicons name="images-outline" size={22} color={colors.primary} />
          <View style={styles.emptyCopy}>
            <Text style={styles.emptyTitle}>No Moments yet</Text>
            {ownProfile ? <Text style={styles.emptyText}>Your activity memories will appear here.</Text> : null}
          </View>
        </View>
      ) : null}

      {!loading && moment ? (
        <View style={styles.card}>
          {!imageFailed && moment.images[0] ? (
            <View style={styles.imageWrap}>
              <Image source={{ uri: moment.images[0] }} style={styles.image} resizeMode="cover" onError={() => setImageFailed(true)} />
              {moment.images.length > 1 ? (
                <View style={styles.imageCount}><Ionicons name="images" size={13} color={colors.text} /><Text style={styles.imageCountText}>+{moment.images.length - 1}</Text></View>
              ) : null}
            </View>
          ) : <View style={styles.imageFallback}><Ionicons name="image-outline" size={30} color={colors.textSubtle} /><Text style={styles.imageFallbackText}>Photo unavailable</Text></View>}

          <View style={styles.content}>
            <Text style={styles.activityLabel}>MOMENT FROM</Text>
            <TouchableOpacity disabled={!moment.activity.id} onPress={() => moment.activity.id && onActivityPress(moment.activity.id)}>
              <Text style={styles.activityTitle}>{moment.activity.title}</Text>
            </TouchableOpacity>
            <Text style={styles.activityMeta}>Joined · {momentDate(moment.activity.date)}{moment.activity.location ? ` · ${moment.activity.location}` : ''}</Text>
            {moment.caption ? <Text style={styles.caption} numberOfLines={3}>{moment.caption}</Text> : null}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.like} disabled={busy || !onToggleLike} onPress={() => onToggleLike?.(moment)} accessibilityLabel={`${moment.likedByViewer ? 'Unlike' : 'Like'} latest Moment`}>
                {busy ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name={moment.likedByViewer ? 'heart' : 'heart-outline'} size={20} color={moment.likedByViewer ? colors.primary : colors.text} />}
                <Text style={styles.likeCount}>{moment.likeCount}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.viewAll} onPress={onViewAll}>
                <Text style={styles.viewAllText}>View all Moments ({total})</Text>
                <Ionicons name="arrow-forward" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.lg },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  eyebrow: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1.2 },
  heading: { color: colors.text, fontSize: 19, fontWeight: '900', marginTop: 2 },
  loading: { minHeight: 90, alignItems: 'center', justifyContent: 'center' },
  empty: { minHeight: 70, flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  emptyCopy: { marginLeft: spacing.md },
  emptyTitle: { color: colors.text, fontSize: 13, fontWeight: '900' },
  emptyText: { color: colors.textSubtle, fontSize: 11, marginTop: 3 },
  card: { overflow: 'hidden', borderRadius: 20, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: .28, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 7 },
  imageWrap: { position: 'relative' },
  image: { width: '100%', aspectRatio: 1.25, backgroundColor: colors.surfaceElevated },
  imageCount: { position: 'absolute', right: 12, top: 12, height: 30, minWidth: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 15, paddingHorizontal: 10, backgroundColor: 'rgba(5,5,5,.82)' },
  imageCountText: { color: colors.text, fontSize: 11, fontWeight: '900', marginLeft: 4 },
  imageFallback: { width: '100%', aspectRatio: 1.8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceElevated },
  imageFallbackText: { color: colors.textSubtle, fontSize: 11, marginTop: 6 },
  content: { padding: spacing.md },
  activityLabel: { color: colors.primary, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  activityTitle: { color: colors.text, fontSize: 17, fontWeight: '900', marginTop: 3 },
  activityMeta: { color: colors.textSubtle, fontSize: 11, marginTop: 4 },
  caption: { color: colors.textMuted, fontSize: 13, lineHeight: 19, marginTop: spacing.sm },
  actions: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.md },
  like: { minWidth: 58, height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 19, borderWidth: 1, borderColor: colors.border },
  likeCount: { color: colors.text, fontSize: 12, fontWeight: '900', marginLeft: 5 },
  viewAll: { flex: 1, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  viewAllText: { color: colors.primary, fontSize: 12, fontWeight: '900', marginRight: 5 },
});
