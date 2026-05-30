import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ApiUser, loginRequest, registerRequest } from '../api';

type AuthState = {
  user: ApiUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
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
          setUser(JSON.parse(storedUser));
          setToken(storedToken);
        }
      } catch (error) {
        console.warn('Failed to restore auth session', error);
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
    const { token: newToken, user: newUser } = response.data;
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
  };

  const value = useMemo(
    () => ({ user, token, loading, login, register, logout }),
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
