import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { fetchChatRequest, sendChatMessageRequest } from '../api';
import AvatarBadge from '../components/AvatarBadge';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type ChatMessage = {
  id: string;
  author: string;
  text: string;
  time: string;
  pinned?: boolean;
  status?: 'pending' | 'sent' | 'failed';
  reactions?: Array<{ label: string; count: number }>;
};

export default function ChatScreen({ route }: Props) {
  const { chatId } = route.params;
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockedMessage, setLockedMessage] = useState('');

  useEffect(() => {
    if (chatId !== 'general' && token) {
      const loadChat = async () => {
        setLoading(true);
        setLockedMessage('');
        try {
          const response = await fetchChatRequest(chatId, token);
          const chatData = response.data;
          if (chatData && Array.isArray(chatData.messages)) {
            setMessages(chatData.messages.map((message: any, index: number) => ({
              id: message._id || String(index),
              author: message.author?.name || 'Member',
              text: message.message,
              time: message.createdAt
                ? new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
                : 'Now',
              reactions: [],
            })));
          }
        } catch (error) {
          console.warn(error);
          setMessages([]);
          setLockedMessage('You need to join this activity to access the chat.');
        } finally {
          setLoading(false);
        }
      };

      loadChat();
    }
  }, [chatId, token]);

  const sendMessage = async () => {
    if (!draft.trim() || lockedMessage) return;
    const nextMessage = draft.trim();
    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        author: user?.name || 'You',
        text: nextMessage,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        status: token && chatId !== 'general' ? 'pending' : 'sent',
        reactions: [],
      },
    ]);
    setDraft('');
    if (token && chatId !== 'general') {
      try {
        await sendChatMessageRequest(chatId, nextMessage, token);
        setMessages((prev) => prev.map((message) => message.id === tempId ? { ...message, status: 'sent' } : message));
      } catch (error: any) {
        setMessages((prev) => prev.map((message) => message.id === tempId ? { ...message, status: 'failed' } : message));
        Alert.alert('Message not sent', error?.response?.data?.message || 'You need to join this activity to access the chat.');
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.chatSkeletonHeader} />
        {[0, 1, 2].map((item) => (
          <View key={item} style={[styles.chatSkeletonBubble, item === 1 && styles.chatSkeletonBubbleRight]} />
        ))}
        <ActivityIndicator color={colors.primary} size="small" />
      </View>
    );
  }

  if (lockedMessage) {
    return (
      <View style={styles.lockedContainer}>
        <Ionicons name="lock-closed-outline" size={34} color={colors.primary} />
        <Text style={styles.lockedTitle}>Chat locked</Text>
        <Text style={styles.lockedText}>{lockedMessage}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <View style={styles.shell}>
      <View style={styles.chatHeader}>
        <View style={styles.chatIcon}>
          <Ionicons name="chatbubbles-outline" size={20} color={colors.primary} />
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Group chat</Text>
          <Text style={styles.headerMeta}>Chat unlocks after you join the plan</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Text style={styles.emptyChatTitle}>No messages yet.</Text>
            <Text style={styles.emptyChatText}>Start the conversation.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isMe = item.author === user?.name || item.author === 'You';
          return (
            <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
              {!isMe && <View style={styles.messageAvatar}><AvatarBadge name={item.author} size={32} /></View>}
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
                {item.status === 'failed' ? <Text style={styles.messageStatusFailed}>Failed to send</Text> : null}
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

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Message the group..."
          placeholderTextColor={colors.textSubtle}
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Ionicons name="send" size={17} color={colors.primaryText} />
        </TouchableOpacity>
      </View>
      </View>
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
