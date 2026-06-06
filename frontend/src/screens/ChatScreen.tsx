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
  reactions?: Array<{ label: string; count: number }>;
};

const initialMessages: ChatMessage[] = [
  { id: '1', author: 'Mia', text: 'Welcome in. Who is joining tonight?', time: '7:12 PM', reactions: [{ label: 'Going', count: 4 }] },
  { id: '2', author: 'Ava', text: 'I am in. The rooftop plan looks perfect.', time: '7:15 PM', reactions: [{ label: 'Yes', count: 2 }] },
  { id: '3', author: 'Avery', text: 'I booked the corner table. Arrive any time after 7:20.', time: '7:18 PM', pinned: true, reactions: [{ label: 'Pinned', count: 1 }] },
];

export default function ChatScreen({ route }: Props) {
  const { chatId } = route.params;
  const { token, user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (chatId !== 'general' && token) {
      const loadChat = async () => {
        setLoading(true);
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
              reactions: index % 2 === 0 ? [{ label: 'Going', count: 1 + index }] : undefined,
            })));
          }
        } catch (error) {
          console.warn(error);
          Alert.alert('Chat unavailable', 'You need to join this activity to access the chat.');
        } finally {
          setLoading(false);
        }
      };

      loadChat();
    }
  }, [chatId, token]);

  const sendMessage = async () => {
    if (!draft.trim()) return;
    const nextMessage = draft.trim();
    setMessages((prev) => [
      ...prev,
      {
        id: String(prev.length + 1),
        author: user?.name || 'You',
        text: nextMessage,
        time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
        reactions: [],
      },
    ]);
    setDraft('');
    if (token && chatId !== 'general') {
      try {
        await sendChatMessageRequest(chatId, nextMessage, token);
      } catch (error: any) {
        Alert.alert('Message not sent', error?.response?.data?.message || 'You need to join this activity to access the chat.');
      }
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
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
        <View style={styles.avatarStack}>
          {['Mia', 'Ava', 'Avery'].map((name, index) => (
            <View key={name} style={[styles.stackAvatar, { marginLeft: index === 0 ? 0 : -9 }]}>
              <AvatarBadge name={name} size={34} />
            </View>
          ))}
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle}>Active group</Text>
          <Text style={styles.headerMeta}>12 participants - 3 online</Text>
        </View>
      </View>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
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

      <View style={styles.typingRow}>
        <View style={styles.typingDots}>
          <View style={styles.dot} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
        <Text style={styles.typingText}>Avery is typing</Text>
      </View>

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
    alignItems: 'center',
  },
  shell: {
    flex: 1,
    width: '100%',
    maxWidth: 720,
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
  avatarStack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stackAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
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
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: 7,
  },
  typingDots: {
    flexDirection: 'row',
    marginRight: 7,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: 3,
  },
  typingText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
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
