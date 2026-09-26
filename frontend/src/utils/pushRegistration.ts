import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import * as Crypto from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { registerPushDeviceRequest, revokePushDeviceRequest } from '../api';
import { registerForPushNotificationsAsync } from './notifications';

const installationKey = '@joinapp:push-installation';
const registrationKey = '@joinapp:push-registration';
let activeToken: string | null = null;
let work = Promise.resolve();
const acquireWithDeadline = async (devicePushToken?: Notifications.DevicePushToken) => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      registerForPushNotificationsAsync(devicePushToken),
      new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), 10000); }),
    ]);
  } finally { if (timer) clearTimeout(timer); }
};

// Serialize registration and logout; an in-flight registration cannot reactivate
// the device after logout. The installation ID is random, never hardware-derived.
export const startPushRegistration = (token: string) => {
  if (Platform.OS === 'web') return () => {};
  activeToken = token;
  const register = (devicePushToken?: Notifications.DevicePushToken) => {
    work = work.catch(() => {}).then(async () => {
      if (activeToken !== token) return;
      const push = await acquireWithDeadline(devicePushToken);
      if (!push || activeToken !== token) return;
      let installationId = await AsyncStorage.getItem(installationKey);
      if (!installationId) {
        installationId = Crypto.randomUUID();
        await AsyncStorage.setItem(installationKey, installationId);
      }
      const response = await registerPushDeviceRequest(installationId, push, token);
      const registration = { installationId, registrationId: response.data.registrationId };
      await AsyncStorage.setItem(registrationKey, JSON.stringify(registration));
      if (activeToken !== token) {
        await revokePushDeviceRequest(installationId, registration.registrationId, token);
        await AsyncStorage.removeItem(registrationKey);
      }
    }).catch(() => { /* Retry on activation/token change; never log token-bearing errors. */ });
  };
  register();
  const app = AppState.addEventListener('change', (state) => { if (state === 'active') register(); });
  const rotation = Notifications.addPushTokenListener((deviceToken) => register(deviceToken));
  return () => { if (activeToken === token) activeToken = null; app.remove(); rotation.remove(); };
};

export const revokeCurrentPushDevice = async (token: string) => {
  if (Platform.OS === 'web') return;
  if (activeToken === token) activeToken = null;
  try {
    await work;
    const saved = await AsyncStorage.getItem(registrationKey);
    if (saved) {
      const registration = JSON.parse(saved);
      await revokePushDeviceRequest(registration.installationId, registration.registrationId, token);
    }
  } catch { /* Logout still completes offline. */ }
  finally { await AsyncStorage.removeItem(registrationKey).catch(() => {}); }
};
