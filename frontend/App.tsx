import React, { useEffect, useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Constants from 'expo-constants';
import { ActivityIndicator, Platform, StyleSheet, View, Text, useWindowDimensions } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import ChatScreen from './src/screens/ChatScreen';
import LoginScreen from './src/screens/LoginScreen';
import CreateActivityScreen from './src/screens/CreateActivityScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import MessagesScreen, { MessageRequestsScreen } from './src/screens/MessagesScreen';
import MapModeScreen from './src/screens/MapModeScreen';
import type { ActivityResponse } from './src/api';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { MessagingProvider } from './src/context/MessagingContext';
import { colors } from './src/theme';
import { getApiConfigStatus, initializeApiConfig } from './src/api';
import ResponsiveAppContainer from './src/components/ResponsiveAppContainer';
import CinematicAppBackdrop from './src/components/CinematicAppBackdrop';
import Logo from './src/components/Logo';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: { mode?: 'login' | 'register' } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  PublicProfile: { userId?: string; fallbackName?: string; fallbackAvatar?: string };
  Home: {
    source?: 'map';
    mapDecisionActivity?: ActivityResponse;
    mapReturnRouteKey?: string;
  } | undefined;
  MapMode: {
    activity: ActivityResponse;
    activities?: ActivityResponse[];
    decisionResult?: {
      activityId: string;
      decision: 'skip' | 'join';
      joinStatus?: 'joined' | 'pending' | 'declined' | 'waitlisted';
      completedAt: number;
    };
  };
  Activity: { activityId: string };
  CreateActivity: undefined;
  Chat: { chatId: string; title: string };
  Messages: undefined;
  MessageRequests: undefined;
  Profile: undefined;
  Settings: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const getLinkingPrefixes = () => {
  const configuredUrl = (Constants.expoConfig?.extra as any)?.FRONTEND_URL;
  const productionPrefixes = [configuredUrl || 'https://joinapp.app'];
  const developmentPrefixes = ['http://localhost:19007', 'http://10.180.219.20:19007'];

  return __DEV__ ? [...developmentPrefixes, ...productionPrefixes] : productionPrefixes;
};

type AppNavigatorProps = {
  onRouteChange: (routeName: keyof RootStackParamList) => void;
};

function AppNavigator({ onRouteChange }: AppNavigatorProps) {
  const { user, loading } = useAuth();
  const navigationRef = useNavigationContainerRef<RootStackParamList>();
  const initialRouteName = user ? 'Home' : 'Onboarding';

  const reportActiveRoute = () => {
    const routeName = navigationRef.getCurrentRoute()?.name as keyof RootStackParamList | undefined;
    onRouteChange(routeName || initialRouteName);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Logo size={54} animate />
        <Text style={styles.loadingText}>Restoring session...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={reportActiveRoute}
      onStateChange={reportActiveRoute}
      linking={{
        prefixes: getLinkingPrefixes(),
        config: {
          screens: {
            ForgotPassword: 'forgot-password',
            ResetPassword: 'reset-password',
            PublicProfile: 'users/:userId',
          },
        },
      }}
    >
      <Stack.Navigator
        key={user ? 'authenticated' : 'unauthenticated'}
        initialRouteName={initialRouteName}
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontWeight: '800' },
        }}
      >
        {user ? (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
            <Stack.Screen
              name="MapMode"
              component={MapModeScreen}
              options={{ headerShown: false, animation: 'none' }}
            />
            <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: 'Activity Details' }} />
            <Stack.Screen name="CreateActivity" component={CreateActivityScreen} options={{ title: 'Host Activity' }} />
            <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
            <Stack.Screen name="MessageRequests" component={MessageRequestsScreen} options={{ title: 'Message Requests' }} />
            <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.title })} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen}
              options={{ title: 'Profile' }}
            />
          </>
        ) : (
          <>
            <Stack.Screen
              name="Onboarding"
              component={OnboardingScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ headerShown: false, animation: 'fade_from_bottom' }}
            />
            <Stack.Screen
              name="ResetPassword"
              component={ResetPasswordScreen}
              options={{ title: 'Reset Password' }}
            />
            <Stack.Screen
              name="ForgotPassword"
              component={ForgotPasswordScreen}
              options={{ title: 'Forgot Password' }}
            />
            <Stack.Screen
              name="PublicProfile"
              component={PublicProfileScreen}
              options={{ title: 'Profile' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppCanvas() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;
  const [routeName, setRouteName] = useState<keyof RootStackParamList>('Onboarding');
  const isCinematicEntry = isDesktopWeb && (routeName === 'Onboarding' || routeName === 'Login');

  return (
    <View style={styles.appStage}>
      <CinematicAppBackdrop />
      <ResponsiveAppContainer
        fullWidth={isCinematicEntry}
        style={[styles.appFrame, isDesktopWeb && !isCinematicEntry && styles.desktopAppFrame]}
      >
        <AppNavigator onRouteChange={setRouteName} />
      </ResponsiveAppContainer>
    </View>
  );
}

export default function App() {
  const [apiConfigReady, setApiConfigReady] = useState(false);
  const [apiConfig, setApiConfig] = useState(getApiConfigStatus());

  useEffect(() => {
    let mounted = true;

    initializeApiConfig()
      .then((status) => {
        if (mounted) {
          setApiConfig(status);
          setApiConfigReady(true);
        }
      })
      .catch(() => {
        if (mounted) {
          setApiConfig(getApiConfigStatus());
          setApiConfigReady(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  if (!apiConfigReady) {
    return (
      <View style={styles.loadingContainer}>
        <Logo size={54} animate />
        <Text style={styles.loadingText}>Starting JOIN...</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  if (!apiConfig.apiUrl) {
    return (
      <View style={styles.configErrorContainer}>
        <Text style={styles.configErrorTitle}>JOIN is not configured correctly.</Text>
        <Text style={styles.configErrorText}>Please contact support or check environment settings.</Text>
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <MessagingProvider>
          <AppCanvas />
        </MessagingProvider>
        <StatusBar style="light" />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  appStage: {
    flex: 1,
    backgroundColor: '#070707',
    alignItems: 'center',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(11,11,11,0.88)',
  },
  desktopAppFrame: {
    maxWidth: 520,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOpacity: 0.35,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: colors.text,
    fontSize: 16,
  },
  configErrorContainer: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: 28,
  },
  configErrorTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 12,
  },
  configErrorText: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
  },
});
