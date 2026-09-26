import React, { useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { useMessaging } from '../context/MessagingContext';
import { ChatMessageResponse, fetchChatRequest, sendChatMessageRequest } from '../api';
import AvatarBadge from '../components/AvatarBadge';
import BottomNavigation, {
  BOTTOM_NAV_WEB_CONTENT_CLEARANCE,
  getBottomNavigationClearance,
} from '../components/BottomNavigation';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type ChatMessage = {
  id: string;
  senderId: string;
  author: string;
  avatar?: string;
  text: string;
  time: string;
  createdAt: string;
  clientMessageId?: string;
  pinned?: boolean;
  status?: 'pending' | 'sent' | 'failed';
  reactions?: Array<{ label: string; count: number }>;
};

export const mapChatMessages = (values: ChatMessageResponse[]): ChatMessage[] => (values || []).map((message) => ({
  id: message.id,
  senderId: message.sender.id,
  author: message.sender.name || 'Former JOIN member',
  avatar: message.sender.avatar,
  text: message.text,
  createdAt: message.createdAt,
  time: message.createdAt
    ? new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : 'Now',
  reactions: [],
}));

export const mergeChatMessages = (current: ChatMessage[], incoming: ChatMessage[]) => {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
};

export default function ChatScreen({ route }: Props) {
  const { chatId } = route.params;
  const { token, user } = useAuth();
  const { refreshUnreadConversations } = useMessaging();
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const bottomNavigationClearance = Platform.OS === 'web'
    ? BOTTOM_NAV_WEB_CONTENT_CLEARANCE
    : getBottomNavigationClearance(safeAreaInsets?.bottom ?? 0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedMessage, setLockedMessage] = useState('');
  const [chatTitle, setChatTitle] = useState(route.params.title);
  const [chatKind, setChatKind] = useState<'activity' | 'direct'>('activity');
  const [readOnly, setReadOnly] = useState(false);
  const [olderLoading, setOlderLoading] = useState(false);
  const [olderError, setOlderError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const latestCursorRef = useRef<string | null>(null);
  const focusedRef = useRef(false);
  const requestGeneration = useRef(0);

  const applyMetadata = useCallback((chatData: any) => {
    const isDirect = chatData.chatType === 'directPrivateChat';
    const otherMember = isDirect ? chatData.members?.find((member: any) => (member._id || member.id) !== user?.id) : null;
    setChatKind(isDirect ? 'direct' : 'activity');
    setChatTitle(isDirect ? otherMember?.name || route.params.title : chatData.activity?.title || route.params.title);
    setReadOnly(!isDirect && Boolean(chatData.readOnly || chatData.activity?.status === 'cancelled'));
  }, [route.params.title, user?.id]);

  const refreshLatest = useCallback(async (initial = false) => {
    if (chatId === 'general' || !token || (!focusedRef.current && !initial)) return;
    const generation = requestGeneration.current;
    if (initial) setLoading(true);
    try {
      const response = await fetchChatRequest(chatId, token,
        !initial && latestCursorRef.current ? { after: latestCursorRef.current } : undefined);
      if (generation !== requestGeneration.current || (!focusedRef.current && !initial)) return;
      applyMetadata(response.data);
      const mapped = mapChatMessages(response.data.messages);
      setMessages((current) => initial ? mapped : mergeChatMessages(current, mapped));
      if (initial) { setNextCursor(response.data.nextCursor); setHasMore(response.data.hasMore); }
      if (response.data.latestCursor) latestCursorRef.current = response.data.latestCursor;
      setLockedMessage('');
      await refreshUnreadConversations();
    } catch (error: any) {
      if (generation !== requestGeneration.current) return;
      if (initial) setLockedMessage(error?.response?.data?.message || 'Unable to load this chat.');
    } finally {
      if (initial && generation === requestGeneration.current) setLoading(false);
    }
  }, [applyMetadata, chatId, refreshUnreadConversations, token]);

  useFocusEffect(useCallback(() => {
    focusedRef.current = true;
    requestGeneration.current += 1;
    latestCursorRef.current = null;
    void refreshLatest(true);
    const interval = setInterval(() => { if (AppState.currentState === 'active') void refreshLatest(false); }, 4000);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void refreshLatest(false); });
    return () => { focusedRef.current = false; requestGeneration.current += 1; clearInterval(interval); subscription.remove(); };
  }, [refreshLatest]));

  const loadOlder = async () => {
    if (!token || !nextCursor || olderLoading) return;
    setOlderLoading(true); setOlderError('');
    const generation = requestGeneration.current;
    try {
      const response = await fetchChatRequest(chatId, token, { before: nextCursor });
      if (generation !== requestGeneration.current || !focusedRef.current) return;
      setMessages((current) => mergeChatMessages(current, mapChatMessages(response.data.messages)));
      setNextCursor(response.data.nextCursor); setHasMore(response.data.hasMore);
    } catch { if (generation === requestGeneration.current) setOlderError('Older messages could not be loaded. Tap to retry.'); }
    finally { if (generation === requestGeneration.current) setOlderLoading(false); }
  };

  const submitMessage = async (nextMessage: string, clientMessageId: string, tempId: string) => {
    if (!token) return;
    try {
      const response = await sendChatMessageRequest(chatId, nextMessage, clientMessageId, token);
      const saved = mapChatMessages([response.data.message])[0];
      setMessages((current) => mergeChatMessages(current.filter((message) => message.id !== tempId), [saved]));
      void refreshUnreadConversations();
    } catch (error: any) {
      if (error?.response?.data?.code === 'ACTIVITY_CHAT_READ_ONLY') setReadOnly(true);
      setMessages((current) => current.map((message) => message.id === tempId ? { ...message, status: 'failed' } : message));
      Alert.alert('Message not sent', error?.response?.data?.message || 'Please try again.');
    }
  };

  const sendMessage = async () => {
    if (!draft.trim() || lockedMessage || readOnly) return;
    const nextMessage = draft.trim();
    const clientMessageId = `${user?.id || 'anonymous'}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempId = `local-${clientMessageId}`;
    const createdAt = new Date().toISOString();
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        senderId: user?.id || '', author: user?.name || 'You',
        text: nextMessage,
        createdAt,
        clientMessageId,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        status: token && chatId !== 'general' ? 'pending' : 'sent',
        reactions: [],
      },
    ]);
    setDraft('');
    if (token && chatId !== 'general') {
      void submitMessage(nextMessage, clientMessageId, tempId);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <View style={styles.chatSkeletonHeader} />
          {[0, 1, 2].map((item) => (
            <View key={item} style={[styles.chatSkeletonBubble, item === 1 && styles.chatSkeletonBubbleRight]} />
          ))}
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
        <BottomNavigation />
      </View>
    );
  }

  if (lockedMessage) {
    return (
      <View style={styles.container}>
        <View style={styles.lockedContainer}>
          <Ionicons name="lock-closed-outline" size={34} color={colors.primary} />
          <Text style={styles.lockedTitle}>Chat locked</Text>
          <Text style={styles.lockedText}>{lockedMessage}</Text>
        </View>
        <BottomNavigation />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={[styles.shell, { paddingBottom: bottomNavigationClearance }]}>
      <View style={styles.chatHeader}>
        <View style={styles.chatIcon}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>{chatTitle}</Text>
          <Text style={styles.headerMeta}>{readOnly ? 'Cancelled · Read-only' : chatKind === 'activity' ? 'Activity group chat' : 'Direct conversation'}</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={[
          styles.messageContent,
          { paddingBottom: bottomNavigationClearance },
        ]}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
        ListHeaderComponent={hasMore || olderError ? (
          <TouchableOpacity style={styles.olderButton} disabled={olderLoading} onPress={loadOlder} accessibilityLabel="Load older messages">
            {olderLoading ? <ActivityIndicator size="small" color={colors.primary} />
              : <Text style={styles.olderText}>{olderError || 'Load older messages'}</Text>}
          </TouchableOpacity>
        ) : null}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatTitle}>No messages yet.</Text>
            <Text style={styles.emptyChatText}>Start the conversation.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.senderId === user?.id;
          return (
            <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
              {!isMe && <View style={styles.messageAvatar}><AvatarBadge name={item.author} avatarUrl={item.avatar} size={32} /></View>}
              <View style={[styles.messageBubble, item.pinned && styles.messageBubblePinned, isMe && styles.messageBubbleMe]}>
                {item.pinned && (
                  <View style={styles.pinnedRow}>
                    <Ionicons name="bookmark-outline" size={12} color={colors.primary} />
                    <Text style={styles.pinnedText}>Important update</Text>
                  </View>
                )}
                <View style={styles.messageMeta}>
                  <Text style={[styles.messageAuthor, isMe && styles.messageAuthorMe]}>{isMe ? 'You' : item.author}</Text>
                  <Text style={styles.messageTime}>{item.time}</Text>
                </View>
                <Text style={[styles.messageText, isMe && styles.messageTextMe]}>{item.text}</Text>
                {item.status === 'pending' ? <Text style={styles.messageStatus}>Sending...</Text> : null}
                {item.status === 'failed' ? (
                  <TouchableOpacity accessibilityLabel="Retry message" onPress={() => item.clientMessageId && submitMessage(item.text, item.clientMessageId, item.id)}>
                    <Text style={styles.messageStatusFailed}>Failed to send · Tap to retry</Text>
                  </TouchableOpacity>
                ) : null}
                {item.reactions?.length ? (
                  <View style={styles.reactionsRow}>
                    {item.reactions.map((reaction) => (
                      <View key={reaction.label} style={styles.reaction}>
                        <Text style={styles.reactionText}>{reaction.label} - {reaction.count}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }}
      />

      {readOnly ? (
        <View style={styles.readOnlyRow}>
          <Ionicons name="lock-closed-outline" size={17} color={colors.primary} />
          <Text style={styles.readOnlyText}>This activity was cancelled. This chat is now read-only.</Text>
        </View>
      ) : <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={chatKind === 'activity' ? 'Message the group...' : 'Write a message...'}
          placeholderTextColor={colors.textSubtle}
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={17} color={colors.primaryText} />
        </TouchableOpacity>
      </View>}
      </View>
      <BottomNavigation />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  chatSkeletonHeader: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  chatSkeletonBubble: {
    width: '78%',
    height: 72,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  chatSkeletonBubbleRight: {
    alignSelf: 'flex-end',
    backgroundColor: colors.goldWash,
    borderColor: colors.goldBorder,
  },
  lockedContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  lockedTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
    marginTop: spacing.md,
  },
  lockedText: {
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 500,
    alignSelf: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    backgroundColor: colors.surface,
  },
  chatIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.goldWash,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: {
    marginLeft: spacing.md,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  headerMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  messageList: {
    flex: 1,
  },
  messageContent: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    flexGrow: 1,
  },
  olderButton: { alignSelf: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginBottom: spacing.md },
  olderText: { color: colors.primary, fontSize: 12, fontWeight: '800' },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  emptyChatTitle: {
    color: colors.text,
    fontWeight: '900',
    fontSize: 18,
  },
  emptyChatText: {
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: spacing.md,
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: spacing.sm,
  },
  messageBubble: {
    maxWidth: '82%',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
  },
  messageBubbleMe: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  messageBubblePinned: {
    borderColor: colors.goldBorder,
    backgroundColor: colors.surfaceElevated,
  },
  pinnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  pinnedText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  messageMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  messageAuthor: {
    color: colors.accent,
    fontWeight: '900',
    fontSize: 12,
    marginRight: spacing.sm,
  },
  messageAuthorMe: {
    color: colors.primaryText,
  },
  messageTime: {
    color: colors.textSubtle,
    fontSize: 11,
  },
  messageText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextMe: {
    color: colors.primaryText,
    fontWeight: '700',
  },
  messageStatus: {
    color: colors.textSubtle,
    fontSize: 11,
    marginTop: spacing.xs,
  },
  messageStatusFailed: {
    color: colors.danger,
    fontSize: 11,
    marginTop: spacing.xs,
    fontWeight: '800',
  },
  reactionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
  },
  reaction: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    marginRight: spacing.sm,
  },
  reactionText: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
  },
  readOnlyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.surface,
  },
  readOnlyText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    marginLeft: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    backgroundColor: colors.background,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: 8,
    marginRight: spacing.md,
    borderColor: colors.border,
    borderWidth: 1,
  },
  sendButton: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 45,
    height: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
