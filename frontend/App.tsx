import React, { useState } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
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
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme';
import { getApiConfigStatus } from './src/api';
import ResponsiveAppContainer from './src/components/ResponsiveAppContainer';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: { mode?: 'login' | 'register' } | undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  PublicProfile: { userId?: string; fallbackName?: string; fallbackAvatar?: string };
  Home: undefined;
  Activity: { activityId: string };
  CreateActivity: undefined;
  Chat: { chatId: string; title: string };
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
        <ActivityIndicator size="large" color={colors.primary} />
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
        initialRouteName={initialRouteName}
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          contentStyle: { backgroundColor: colors.background },
          headerTitleStyle: { fontWeight: '800' },
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
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
        <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: 'Activity Details' }} />
        <Stack.Screen name="CreateActivity" component={CreateActivityScreen} options={{ title: 'Host Activity' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.title })} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function AppCanvas() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 768;
  const [routeName, setRouteName] = useState<keyof RootStackParamList>('Onboarding');
  const isCinematicEntry = isDesktopWeb && routeName === 'Onboarding';

  return (
    <View style={styles.appStage}>
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
  const apiConfig = getApiConfigStatus();

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
    <AuthProvider>
      <AppCanvas />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  appStage: {
    flex: 1,
    backgroundColor: colors.secondaryBackground,
    alignItems: 'center',
  },
  appFrame: {
    flex: 1,
    width: '100%',
    backgroundColor: colors.background,
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
