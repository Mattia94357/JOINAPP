import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, View, Text } from 'react-native';
import HomeScreen from './src/screens/HomeScreen';
import ActivityScreen from './src/screens/ActivityScreen';
import ChatScreen from './src/screens/ChatScreen';
import LoginScreen from './src/screens/LoginScreen';
import CreateActivityScreen from './src/screens/CreateActivityScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import NotificationsScreen from './src/screens/NotificationsScreen';
import ResetPasswordScreen from './src/screens/ResetPasswordScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';
import PublicProfileScreen from './src/screens/PublicProfileScreen';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { colors } from './src/theme';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
  ForgotPassword: undefined;
  ResetPassword: { token?: string } | undefined;
  PublicProfile: { userId?: string; fallbackName?: string; fallbackAvatar?: string };
  Home: undefined;
  Activity: { activityId: string };
  CreateActivity: undefined;
  Chat: { chatId: string; title: string };
  Profile: undefined;
  Notifications: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function AppNavigator() {
  const { user, loading } = useAuth();

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
      linking={{
        prefixes: ['http://localhost:19007', 'http://10.180.219.20:19007'],
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
        initialRouteName={user ? 'Home' : 'Onboarding'}
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
          options={{ title: 'Welcome to JoinApp', headerBackVisible: false }}
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
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'Discover Activities' }} />
        <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: 'Activity Details' }} />
        <Stack.Screen name="CreateActivity" component={CreateActivityScreen} options={{ title: 'Host Activity' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={({ route }) => ({ title: route.params.title })} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppNavigator />
      <StatusBar style="light" />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
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
});
