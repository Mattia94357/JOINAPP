import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { fetchChatRequest } from '../api';

type Props = NativeStackScreenProps<RootStackParamList, 'Chat'>;

type ChatMessage = {
  id: string;
  author: string;
  text: string;
};

const initialMessages: ChatMessage[] = [
  { id: '1', author: 'Mia', text: 'Welcome to the group! Who is joining tonight?' },
  { id: '2', author: 'Ava', text: 'I am in for the rooftop yoga.' },
];

export default function ChatScreen({ route }: Props) {
  const { chatId } = route.params;
  const { token } = useAuth();
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
            })));
          }
        } catch (error) {
          console.warn(error);
          Alert.alert('Chat unavailable', 'Could not load chat from the server.');
        } finally {
          setLoading(false);
        }
      };

      loadChat();
    }
  }, [chatId, token]);

  const sendMessage = () => {
    if (!draft.trim()) return;
    setMessages((prev) => [...prev, { id: String(prev.length + 1), author: 'You', text: draft.trim() }]);
    setDraft('');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color="#f5c12d" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={100}
    >
      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        style={styles.messageList}
        contentContainerStyle={styles.messageContent}
        renderItem={({ item }) => (
          <View style={styles.messageBubble}>
            <Text style={styles.messageAuthor}>{item.author}</Text>
            <Text style={styles.messageText}>{item.text}</Text>
          </View>
        )}
      />
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Write a message..."
          placeholderTextColor="#777"
          value={draft}
          onChangeText={setDraft}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageList: {
    flex: 1,
    padding: 18,
  },
  messageContent: {
    paddingBottom: 24,
  },
  messageBubble: {
    backgroundColor: '#111',
    borderColor: '#333',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  messageAuthor: {
    color: '#f5c12d',
    fontWeight: '700',
    marginBottom: 6,
    fontSize: 13,
  },
  messageText: {
    color: '#eee',
    fontSize: 16,
    lineHeight: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderTopColor: '#222',
    borderTopWidth: 1,
    backgroundColor: '#000',
  },
  input: {
    flex: 1,
    backgroundColor: '#111',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    marginRight: 10,
    borderColor: '#333',
    borderWidth: 1,
  },
  sendButton: {
    backgroundColor: '#f5c12d',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 18,
  },
  sendText: {
    color: '#000',
    fontWeight: '700',
  },
});
