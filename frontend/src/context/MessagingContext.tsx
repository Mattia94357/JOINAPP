import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchUnreadConversationCountRequest } from '../api';
import { useAuth } from './AuthContext';

type MessagingContextValue = {
  unreadConversationCount: number;
  unreadRequestCount: number;
  refreshUnreadConversations: () => Promise<void>;
};

const MessagingContext = createContext<MessagingContextValue>({
  unreadConversationCount: 0,
  unreadRequestCount: 0,
  refreshUnreadConversations: async () => undefined,
});

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  const [unreadConversationCount, setUnreadConversationCount] = useState(0);
  const [unreadRequestCount, setUnreadRequestCount] = useState(0);
  const sessionGeneration = useRef(0);
  const sessionKey = `${user?.id || ''}:${token || ''}`;
  const activeSessionKey = useRef(sessionKey);
  activeSessionKey.current = sessionKey;
  useEffect(() => { sessionGeneration.current += 1; }, [sessionKey]);

  const refreshUnreadConversations = useCallback(async () => {
    if (!token || !user) {
      setUnreadConversationCount(0);
      setUnreadRequestCount(0);
      return;
    }

    const generation = sessionGeneration.current;
    const requestedSession = sessionKey;
    try {
      const response = await fetchUnreadConversationCountRequest(token);
      if (generation !== sessionGeneration.current || requestedSession !== activeSessionKey.current) return;
      setUnreadConversationCount(response.data.unreadConversationCount || 0);
      setUnreadRequestCount(response.data.unreadRequestCount || 0);
    } catch {
      // Keep the last known badge state during brief network interruptions.
    }
  }, [token, user, sessionKey]);

  useEffect(() => {
    void refreshUnreadConversations();
    if (!token || !user) return undefined;

    const interval = setInterval(() => {
      void refreshUnreadConversations();
    }, 5000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshUnreadConversations();
    });

    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [refreshUnreadConversations, token, user]);

  const value = useMemo(() => ({
    unreadConversationCount,
    unreadRequestCount,
    refreshUnreadConversations,
  }), [refreshUnreadConversations, unreadConversationCount, unreadRequestCount]);

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

export const useMessaging = () => useContext(MessagingContext);
