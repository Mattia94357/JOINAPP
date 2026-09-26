import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

if (Platform.OS !== 'web') Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export const registerForPushNotificationsAsync = async (devicePushToken?: Notifications.DevicePushToken) => {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId || Constants.easConfig?.projectId;
    if (typeof projectId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId)) return null;
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('activity-updates', {
        name: 'Activity updates', importance: Notifications.AndroidImportance.HIGH, sound: null, enableVibrate: false, showBadge: false,
      });
    }
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status === 'undetermined' && permission.canAskAgain && !(await AsyncStorage.getItem('@joinapp:push-permission-asked'))) {
      await AsyncStorage.setItem('@joinapp:push-permission-asked', 'true');
      permission = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: false, allowBadge: false } });
    }
    if (!permission.granted && permission.ios?.status !== Notifications.IosAuthorizationStatus.PROVISIONAL) return null;
    const result = await Notifications.getExpoPushTokenAsync({ projectId, ...(devicePushToken ? { devicePushToken } : {}) });
    return { expoPushToken: result.data, projectId, platform: Platform.OS as 'ios' | 'android' };
  } catch { return null; } // Push failures never block authentication.
};
