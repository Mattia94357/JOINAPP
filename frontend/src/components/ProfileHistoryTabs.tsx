import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MomentResponse, ProfileActivity } from '../api';
import { colors, spacing } from '../theme';
import { getActivityCoverImage } from '../utils/activityAssets';
import MomentCard from './MomentCard';

type Tab = 'joined' | 'hosted' | 'moments';
type Props = {
  joined: ProfileActivity[];
  hosted: ProfileActivity[];
  moments: MomentResponse[];
  joinedCount?: number;
  hostedCount?: number;
  loading?: boolean;
  ownProfile?: boolean;
  busyMomentId?: string;
  onActivityPress: (activityId: string) => void;
  onCreatorPress?: (userId: string) => void;
  onToggleLike?: (moment: MomentResponse) => void;
  onDeleteMoment?: (moment: MomentResponse) => void;
};

const activityTime = (activity: ProfileActivity) => new Date(activity.date).getTime();
const HistoryList = ({ activities, empty, onPress }: { activities: ProfileActivity[]; empty: string; onPress: (id: string) => void }) => {
  const now = Date.now();
  const upcoming = activities.filter((activity) => activityTime(activity) > now).sort((a, b) => activityTime(a) - activityTime(b));
  const past = activities.filter((activity) => activityTime(activity) <= now).sort((a, b) => activityTime(b) - activityTime(a));
  if (!activities.length) return <Text style={styles.empty}>{empty}</Text>;

  const renderGroup = (label: string, items: ProfileActivity[]) => items.length ? (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{label}</Text>
      {items.map((activity) => (
        <TouchableOpacity key={activity._id} style={styles.activityCard} onPress={() => onPress(activity._id)} activeOpacity={0.82}>
          <Image source={{ uri: activity.coverImage || getActivityCoverImage(activity.category, activity._id) }} style={styles.activityImage} />
          <View style={styles.activityCopy}>
            <Text style={styles.activityTitle} numberOfLines={1}>{activity.title}</Text>
            <Text style={styles.activityCategory}>{activity.category}</Text>
            <Text style={styles.activityMeta} numberOfLines={1}>{new Date(activity.date).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}  ·  {activity.location || 'Location private'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.primary} />
        </TouchableOpacity>
      ))}
    </View>
  ) : null;

  return <>{renderGroup('UPCOMING', upcoming)}{renderGroup('PAST', past)}</>;
};

export default function ProfileHistoryTabs(props: Props) {
  const [tab, setTab] = useState<Tab>('joined');
  const tabs = useMemo(() => [
    { id: 'joined' as const, label: 'JOINED', count: props.joinedCount ?? props.joined.length },
    { id: 'hosted' as const, label: 'HOSTED', count: props.hostedCount ?? props.hosted.length },
    { id: 'moments' as const, label: 'MOMENTS', count: props.moments.length },
  ], [props.hosted.length, props.hostedCount, props.joined.length, props.joinedCount, props.moments.length]);

  return (
    <View style={styles.wrap}>
      <View style={styles.tabs}>
        {tabs.map((item) => (
          <TouchableOpacity key={item.id} style={[styles.tab, tab === item.id && styles.tabActive]} onPress={() => setTab(item.id)}>
            <Text style={[styles.tabText, tab === item.id && styles.tabTextActive]}>{item.label}</Text>
            <Text style={[styles.tabCount, tab === item.id && styles.tabCountActive]}>{item.count}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {props.loading ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      {!props.loading && tab === 'joined' ? <HistoryList activities={props.joined} empty="No activities joined yet" onPress={props.onActivityPress} /> : null}
      {!props.loading && tab === 'hosted' ? <HistoryList activities={props.hosted} empty="No activities hosted yet" onPress={props.onActivityPress} /> : null}
      {!props.loading && tab === 'moments' ? (
        props.moments.length ? props.moments.map((moment) => (
          <MomentCard
            key={moment.id}
            moment={moment}
            busy={props.busyMomentId === moment.id}
            onActivityPress={props.onActivityPress}
            onCreatorPress={props.onCreatorPress}
            onToggleLike={props.onToggleLike}
            onDelete={props.onDeleteMoment}
          />
        )) : <View style={styles.momentEmpty}><Ionicons name="images-outline" size={28} color={colors.primary} /><Text style={styles.empty}>No Moments yet</Text>{props.ownProfile ? <Text style={styles.emptyHint}>Your activity memories will appear here.</Text> : null}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: spacing.lg },
  tabs: { flexDirection: 'row', borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 10 },
  tabActive: { backgroundColor: colors.primary },
  tabText: { color: colors.textSubtle, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  tabTextActive: { color: colors.primaryText },
  tabCount: { color: colors.textSubtle, fontSize: 10, marginTop: 2 },
  tabCountActive: { color: colors.primaryText },
  loader: { marginVertical: spacing.xl },
  group: { marginBottom: spacing.md },
  groupTitle: { color: colors.primary, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginBottom: spacing.sm },
  activityCard: { minHeight: 88, flexDirection: 'row', alignItems: 'center', padding: 8, marginBottom: spacing.sm, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  activityImage: { width: 74, height: 72, borderRadius: 10, backgroundColor: colors.surfaceElevated },
  activityCopy: { flex: 1, minWidth: 0, paddingHorizontal: spacing.md },
  activityTitle: { color: colors.text, fontSize: 14, fontWeight: '900' },
  activityCategory: { color: colors.primary, fontSize: 10, fontWeight: '900', marginTop: 4 },
  activityMeta: { color: colors.textSubtle, fontSize: 10, marginTop: 5 },
  empty: { color: colors.textMuted, fontSize: 14, fontWeight: '800', textAlign: 'center', marginTop: spacing.lg },
  emptyHint: { color: colors.textSubtle, fontSize: 12, textAlign: 'center', marginTop: spacing.xs },
  momentEmpty: { alignItems: 'center', paddingVertical: spacing.xl },
});
