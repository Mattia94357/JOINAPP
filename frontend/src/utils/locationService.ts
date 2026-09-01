import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';

export type JoinCoordinate = { latitude: number; longitude: number };

export type JoinLocationResult = {
  status: 'success';
  coordinate: JoinCoordinate;
  accuracy: number | null;
} | {
  status: 'failure';
  reason: 'permission-denied' | 'position-unavailable' | 'timeout' | 'unsupported' | 'unknown';
  errorCode?: number;
  errorMessage?: string;
};

const LAST_MAP_VIEWPORT_KEY = '@joinapp:last-map-viewport';
const CURRENT_LOCATION_MAX_AGE_MS = 60_000;
const LOCATION_TIMEOUT_MS = 15_000;

let cachedCurrentLocation: { result: Extract<JoinLocationResult, { status: 'success' }>; capturedAt: number } | null = null;
let locationRequest: Promise<JoinLocationResult> | null = null;
let permissionDeniedThisSession = false;

export const isValidCoordinate = (value?: Partial<JoinCoordinate> | null): value is JoinCoordinate => Boolean(
  value
  && Number.isFinite(value.latitude)
  && Number.isFinite(value.longitude)
  && Math.abs(value.latitude as number) <= 90
  && Math.abs(value.longitude as number) <= 180,
);

export const isValidMapRegion = (value?: Partial<Region> | null): value is Region => {
  if (!value) return false;
  return isValidCoordinate({ latitude: value.latitude, longitude: value.longitude })
    && Number.isFinite(value.latitudeDelta)
    && Number.isFinite(value.longitudeDelta)
    && (value.latitudeDelta as number) > 0
    && (value.longitudeDelta as number) > 0;
};

const browserCurrentPosition = (): Promise<JoinLocationResult> => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({
      status: 'failure',
      reason: 'unsupported',
      errorMessage: 'navigator.geolocation is unavailable',
    });
  }

  return new Promise<JoinLocationResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const result: JoinLocationResult = {
          status: 'success',
          coordinate: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
        };
        resolve(result);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) permissionDeniedThisSession = true;
        const reason = error.code === error.PERMISSION_DENIED
          ? 'permission-denied'
          : error.code === error.POSITION_UNAVAILABLE
            ? 'position-unavailable'
            : error.code === error.TIMEOUT
              ? 'timeout'
              : 'unknown';
        console.warn('JOIN geolocation error', { code: error.code, message: error.message });
        resolve({
          status: 'failure',
          reason,
          errorCode: error.code,
          errorMessage: error.message,
        });
      },
      { enableHighAccuracy: true, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 },
    );
  });
};

const nativeCurrentPosition = async (): Promise<JoinLocationResult> => {
  const existingPermission = await Location.getForegroundPermissionsAsync();
  const permission = existingPermission.granted || !existingPermission.canAskAgain
    ? existingPermission
    : await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    permissionDeniedThisSession = true;
    return { status: 'failure', reason: 'permission-denied' };
  }
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Location timed out')), LOCATION_TIMEOUT_MS)),
    ]);
    return {
      status: 'success',
      coordinate: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      accuracy: Number.isFinite(position.coords.accuracy) ? position.coords.accuracy : null,
    };
  } catch (error) {
    return {
      status: 'failure',
      reason: error instanceof Error && error.message === 'Location timed out' ? 'timeout' : 'unknown',
      errorMessage: error instanceof Error ? error.message : undefined,
    };
  }
};

export const getCurrentJoinLocationResult = async (options?: {
  forceRefresh?: boolean;
  retryDenied?: boolean;
}): Promise<JoinLocationResult> => {
  const now = Date.now();
  if (
    !options?.forceRefresh
    && cachedCurrentLocation
    && now - cachedCurrentLocation.capturedAt <= CURRENT_LOCATION_MAX_AGE_MS
  ) return cachedCurrentLocation.result;
  if (permissionDeniedThisSession && !options?.retryDenied) {
    return { status: 'failure', reason: 'permission-denied' };
  }
  if (locationRequest) return locationRequest;

  const pendingRequest: Promise<JoinLocationResult> = (async (): Promise<JoinLocationResult> => {
    const result = Platform.OS === 'web'
      ? await browserCurrentPosition()
      : await nativeCurrentPosition();
    if (result.status === 'failure') return result;
    if (!isValidCoordinate(result.coordinate)) {
      return {
        status: 'failure',
        reason: 'unknown',
        errorMessage: 'Browser returned invalid coordinates',
      };
    }
    cachedCurrentLocation = { result, capturedAt: Date.now() };
    permissionDeniedThisSession = false;
    return result;
  })().finally(() => {
    locationRequest = null;
  });
  locationRequest = pendingRequest;

  return pendingRequest;
};

export const getCurrentJoinLocation = async (options?: {
  forceRefresh?: boolean;
  retryDenied?: boolean;
}) => {
  const result = await getCurrentJoinLocationResult(options);
  return result.status === 'success' ? result.coordinate : null;
};

export const readLastMapViewport = async () => {
  try {
    const raw = await AsyncStorage.getItem(LAST_MAP_VIEWPORT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Region>;
    return isValidMapRegion(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const saveLastMapViewport = async (region: Region) => {
  if (!isValidMapRegion(region)) return;
  const localViewport: Region = {
    latitude: Number(region.latitude.toFixed(5)),
    longitude: Number(region.longitude.toFixed(5)),
    latitudeDelta: region.latitudeDelta,
    longitudeDelta: region.longitudeDelta,
  };
  try {
    await AsyncStorage.setItem(LAST_MAP_VIEWPORT_KEY, JSON.stringify(localViewport));
  } catch {
    // A map viewport is a convenience only; storage failure must not block discovery.
  }
};
