import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import {
  ConversationSummary,
  fetchConversationsRequest,
} from '../api';
import AvatarBadge from '../components/AvatarBadge';
import BottomNavigation, {
  BOTTOM_NAV_WEB_CONTENT_CLEARANCE,
  getBottomNavigationClearance,
} from '../components/BottomNavigation';
import { useAuth } from '../context/AuthContext';
import { useMessaging } from '../context/MessagingContext';
import { colors, spacing } from '../theme';

type MessagesProps = NativeStackScreenProps<RootStackParamList, 'Messages'>;
type RequestsProps = NativeStackScreenProps<RootStackParamList, 'MessageRequests'>;

const formatConversationTime = (value?: string) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
};

function ConversationAvatar({ conversation }: { conversation: ConversationSummary }) {
  if (conversation.type === 'activity' && conversation.image) {
    return <Image source={{ uri: conversation.image }} style={styles.avatarImage} />;
  }
  return (
    <AvatarBadge
      name={conversation.title || 'JOIN member'}
      avatarUrl={conversation.image}
      size={52}
    />
  );
}

function ConversationRow({
  conversation,
  onPress,
}: {
  conversation: ConversationSummary;
  onPress: () => void;
}) {
  const unreadCount = Math.max(0, Number(conversation.unreadCount) || 0);
  return (
    <TouchableOpacity
      style={[styles.row, conversation.unread && styles.rowUnread]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${conversation.title}`}
    >
      <View style={styles.avatarWrap}>
        <ConversationAvatar conversation={conversation} />
        {conversation.type === 'activity' ? (
          <View style={styles.groupMarker}>
            <Ionicons name="people" size={11} color={colors.primaryText} />
          </View>
        ) : null}
      </View>
      <View style={styles.rowCopy}>
        <View style={styles.rowHeading}>
          <Text style={[styles.rowTitle, conversation.unread && styles.rowTitleUnread]} numberOfLines={1}>
            {conversation.title}
          </Text>
          <Text style={[styles.rowTime, conversation.unread && styles.rowTimeUnread]}>
            {formatConversationTime(conversation.latestMessageAt)}
          </Text>
        </View>
        <View style={styles.previewRow}>
          <Text
            style={[styles.preview, conversation.unread && styles.previewUnread]}
            numberOfLines={1}
          >
            {conversation.readOnly
              ? 'Cancelled · Read-only'
              : conversation.latestMessage || (conversation.type === 'activity' ? 'Activity group chat' : 'Start the conversation')}
          </Text>
          {conversation.unread ? (
            <View style={styles.unreadDot}>
              {unreadCount > 0 ? (
                <Text style={styles.unreadDotText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
              ) : null}
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
}

function ConversationList({
  navigation,
  requestMode,
}: {
  navigation: MessagesProps['navigation'] | RequestsProps['navigation'];
  requestMode: boolean;
}) {
  const { token } = useAuth();
  const safeAreaInsets = useSafeAreaInsets();
  const { unreadRequestCount, refreshUnreadConversations } = useMessaging();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const bottomClearance = Platform.OS === 'web'
    ? BOTTOM_NAV_WEB_CONTENT_CLEARANCE
    : getBottomNavigationClearance(safeAreaInsets.bottom);

  const loadConversations = useCallback(async (showLoader = false) => {
    if (!token) {
      setConversations([]);
      setLoadError(false);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    if (showLoader) setLoading(true);
    try {
      const response = await fetchConversationsRequest(token, requestMode ? 'requests' : 'active');
      const nextConversations = Array.isArray(response.data?.conversations)
        ? response.data.conversations
          .filter((conversation) => Boolean(conversation?.id))
          .map((conversation) => ({
            ...conversation,
            title: conversation.title || (conversation.type === 'activity' ? 'Activity chat' : 'Unavailable member'),
            latestMessage: typeof conversation.latestMessage === 'string' ? conversation.latestMessage : '',
          }))
          .sort((first, second) => {
            const firstTime = new Date(first.latestMessageAt || 0).getTime();
            const secondTime = new Date(second.latestMessageAt || 0).getTime();
            return (Number.isNaN(secondTime) ? 0 : secondTime) - (Number.isNaN(firstTime) ? 0 : firstTime);
          })
        : [];
      setConversations(nextConversations);
      setLoadError(false);
      await refreshUnreadConversations();
    } catch {
      // Preserve the current list during temporary connectivity failures.
      setLoadError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [refreshUnreadConversations, requestMode, token]);

  useFocusEffect(useCallback(() => {
    void loadConversations(true);
  }, [loadConversations]));

  const openConversation = (conversation: ConversationSummary) => {
    navigation.navigate('Chat', {
      chatId: conversation.id,
      title: conversation.title || (conversation.type === 'activity' ? 'Activity chat' : 'Messages'),
    });
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
        {!requestMode ? <BottomNavigation /> : null}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.listContent,
          !requestMode && { paddingBottom: bottomClearance },
          conversations.length === 0 && styles.emptyListContent,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              void loadConversations();
            }}
          />
        }
        ListHeaderComponent={!requestMode ? (
          <TouchableOpacity
            style={styles.requestsEntry}
            onPress={() => navigation.navigate('MessageRequests')}
            accessibilityRole="button"
            accessibilityLabel={`Message Requests${unreadRequestCount ? `, ${unreadRequestCount} unread` : ''}`}
          >
            <View style={styles.requestsIcon}>
              <Ionicons name="mail-unread-outline" size={22} color={colors.primary} />
            </View>
            <View style={styles.requestsCopy}>
              <Text style={styles.requestsTitle}>Message Requests</Text>
              <Text style={styles.requestsMeta}>Messages from people outside your activities</Text>
            </View>
            {unreadRequestCount > 0 ? (
              <View style={styles.requestCount}>
                <Text style={styles.requestCountText}>{unreadRequestCount > 99 ? '99+' : unreadRequestCount}</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={20} color={colors.textSubtle} />
          </TouchableOpacity>
        ) : null}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons
              name={loadError ? 'cloud-offline-outline' : requestMode ? 'mail-open-outline' : 'chatbubbles-outline'}
              size={38}
              color={colors.primary}
            />
            <Text style={styles.emptyTitle}>
              {loadError ? 'Messages unavailable' : requestMode ? 'No message requests' : 'No messages yet'}
            </Text>
            <Text style={styles.emptyText}>
              {loadError
                ? 'We could not load your conversations. Please try again.'
                : requestMode
                ? 'New requests from people outside your activities will appear here.'
                : 'Join an activity and start connecting.'}
            </Text>
            {loadError ? (
              <TouchableOpacity style={styles.retryButton} onPress={() => void loadConversations(true)}>
                <Text style={styles.retryButtonText}>Try again</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <ConversationRow conversation={item} onPress={() => openConversation(item)} />
        )}
      />
      {!requestMode ? <BottomNavigation /> : null}
    </View>
  );
}

export default function MessagesScreen({ navigation }: MessagesProps) {
  return <ConversationList navigation={navigation} requestMode={false} />;
}

export function MessageRequestsScreen({ navigation }: RequestsProps) {
  return <ConversationList navigation={navigation} requestMode />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  listContent: {
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  emptyListContent: { flexGrow: 1 },
  requestsEntry: {
    minHeight: 74,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    borderRadius: 14,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  requestsIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.goldWash,
  },
  requestsCopy: { flex: 1, marginHorizontal: spacing.md },
  requestsTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  requestsMeta: { color: colors.textSubtle, fontSize: 11, marginTop: 3 },
  requestCount: {
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginRight: spacing.sm,
  },
  requestCountText: { color: colors.primaryText, fontSize: 11, fontWeight: '900' },
  row: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  rowUnread: { backgroundColor: colors.goldWash },
  avatarWrap: { width: 54, height: 54 },
  avatarImage: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surfaceElevated },
  groupMarker: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
  rowCopy: { flex: 1, marginLeft: spacing.md },
  rowHeading: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '800' },
  rowTitleUnread: { fontWeight: '900' },
  rowTime: { color: colors.textSubtle, fontSize: 11, marginLeft: spacing.sm },
  rowTimeUnread: { color: colors.primary, fontWeight: '800' },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 5 },
  preview: { flex: 1, color: colors.textSubtle, fontSize: 13 },
  previewUnread: { color: colors.text, fontWeight: '700' },
  unreadDot: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
  unreadDotText: { color: colors.primaryText, fontSize: 10, fontWeight: '900' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: spacing.md },
  emptyText: { color: colors.textMuted, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm },
  retryButton: {
    marginTop: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryButtonText: { color: colors.primary, fontSize: 13, fontWeight: '800' },
});
