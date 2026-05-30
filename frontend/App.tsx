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
import { AuthProvider, useAuth } from './src/context/AuthContext';

export type RootStackParamList = {
  Onboarding: undefined;
  Login: undefined;
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
        <ActivityIndicator size="large" color="#f5c12d" />
        <Text style={styles.loadingText}>Restoring session...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName={user ? 'Home' : 'Onboarding'}
        screenOptions={{
          headerStyle: { backgroundColor: '#050505' },
          headerTintColor: '#fff',
          contentStyle: { backgroundColor: '#070707' },
          headerTitleStyle: { fontWeight: '700' },
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
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#fff',
    fontSize: 16,
  },
});
