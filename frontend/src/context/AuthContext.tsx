import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { ApiUser, fetchCurrentUserRequest, loginRequest, registerRequest, updatePushTokenRequest } from '../api';
import { registerForPushNotificationsAsync } from '../utils/notifications';

type AuthState = {
  user: ApiUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  updateUser: (user: ApiUser) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const USER_KEY = '@joinapp:user';
const TOKEN_KEY = '@joinapp:token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function restore() {
      try {
        const [storedUser, storedToken] = await Promise.all([
          AsyncStorage.getItem(USER_KEY),
          AsyncStorage.getItem(TOKEN_KEY),
        ]);

        if (storedUser && storedToken) {
          const response = await fetchCurrentUserRequest(storedToken);
          setUser(response.data);
          setToken(storedToken);
          await AsyncStorage.setItem(USER_KEY, JSON.stringify(response.data));
        }
      } catch {
        await Promise.all([AsyncStorage.removeItem(USER_KEY), AsyncStorage.removeItem(TOKEN_KEY)]);
      } finally {
        setLoading(false);
      }
    }

    restore();
  }, []);

  const login = async (email: string, password: string) => {
    const response = await loginRequest(email, password);
    const { token: newToken, user: newUser } = response.data;
    setUser(newUser);
    setToken(newToken);
    await Promise.all([
      AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
      AsyncStorage.setItem(TOKEN_KEY, newToken),
    ]);
  };

  const register = async (name: string, email: string, password: string) => {
    const response = await registerRequest(name, email, password);
    const { token: newToken } = response.data;
    let newUser = response.data.user;

    try {
      const pushToken = await registerForPushNotificationsAsync();
      if (pushToken) {
        const pushResponse = await updatePushTokenRequest(pushToken, newToken);
        newUser = pushResponse.data;
      }
    } catch (error) {
      console.warn('Unable to register push notifications', error);
    }

    setUser(newUser);
    setToken(newToken);
    await Promise.all([
      AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
      AsyncStorage.setItem(TOKEN_KEY, newToken),
    ]);
  };

  const logout = async () => {
    setUser(null);
    setToken(null);
    await Promise.all([AsyncStorage.removeItem(USER_KEY), AsyncStorage.removeItem(TOKEN_KEY)]);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_KEY);
      window.localStorage.removeItem(TOKEN_KEY);
      window.localStorage.removeItem(`ReactNativeAsyncStorage_${USER_KEY}`);
      window.localStorage.removeItem(`ReactNativeAsyncStorage_${TOKEN_KEY}`);
    }
  };

  const updateUser = async (updatedUser: ApiUser) => {
    setUser(updatedUser);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, updateUser, logout }),
    [user, token, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
