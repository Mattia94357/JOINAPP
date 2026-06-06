import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

const hasNotificationPermission = (permission: unknown) => {
  const status = permission as { granted?: boolean; status?: string };
  return status.granted === true || status.status === 'granted';
};

export const registerForPushNotificationsAsync = async () => {
  if (Platform.OS === 'web') return null;

  const existingPermission = await Notifications.getPermissionsAsync();
  let permissionGranted = hasNotificationPermission(existingPermission);

  if (!permissionGranted) {
    const requestedPermission = await Notifications.requestPermissionsAsync();
    permissionGranted = hasNotificationPermission(requestedPermission);
  }

  if (!permissionGranted) return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  const token = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);

  return token.data;
};
