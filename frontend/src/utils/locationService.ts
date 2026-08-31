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

const developmentLog = (...values: unknown[]) => {
  // Temporary diagnostics for confirming device geolocation on deployed Safari.
  console.info(...values);
};

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

const browserCurrentPosition = async (requestSource: 'INITIAL_MAP' | 'CURRENT_LOCATION_BUTTON' | 'OTHER'): Promise<JoinLocationResult> => {
  const secureContext = typeof window !== 'undefined' && window.isSecureContext;
  const geolocationAvailable = typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
  const inIframe = typeof window !== 'undefined' && window.self !== window.top;
  developmentLog('GEOLOCATION ENVIRONMENT', {
    requestSource,
    secureContext,
    geolocationAvailable,
    inIframe,
    protocol: typeof window !== 'undefined' ? window.location.protocol : 'unavailable',
  });

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    developmentLog('GEOLOCATION ERROR', {
      code: 0,
      message: 'navigator.geolocation is unavailable',
    });
    return {
      status: 'failure',
      reason: 'unsupported',
      errorMessage: 'navigator.geolocation is unavailable',
    };
  }

  try {
    const permission = await navigator.permissions?.query({ name: 'geolocation' });
    developmentLog('GEOLOCATION PERMISSION STATE', permission?.state || 'query-unavailable');
  } catch {
    // Safari does not consistently expose geolocation through Permissions API.
    // getCurrentPosition below remains the source of truth and triggers PROMPT.
    developmentLog('GEOLOCATION PERMISSION STATE', 'query-unavailable');
  }

  developmentLog('GEOLOCATION: starting request', { requestSource });
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
        developmentLog('GEOLOCATION SUCCESS', {
          latitude: result.coordinate.latitude,
          longitude: result.coordinate.longitude,
          accuracy: result.accuracy,
        });
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
        developmentLog('GEOLOCATION ERROR', { code: error.code, message: error.message });
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
  requestSource?: 'INITIAL_MAP' | 'CURRENT_LOCATION_BUTTON' | 'OTHER';
}): Promise<JoinLocationResult> => {
  const now = Date.now();
  if (
    !options?.forceRefresh
    && cachedCurrentLocation
    && now - cachedCurrentLocation.capturedAt <= CURRENT_LOCATION_MAX_AGE_MS
  ) return cachedCurrentLocation.result;
  if (permissionDeniedThisSession && !options?.retryDenied) {
    developmentLog('GEOLOCATION ERROR', {
      code: 1,
      message: 'Location permission was already denied this session; automatic retry suppressed',
    });
    return { status: 'failure', reason: 'permission-denied' };
  }
  if (locationRequest) return locationRequest;

  const pendingRequest: Promise<JoinLocationResult> = (async (): Promise<JoinLocationResult> => {
    const result = Platform.OS === 'web'
      ? await browserCurrentPosition(options?.requestSource || 'OTHER')
      : await nativeCurrentPosition();
    if (result.status === 'failure') return result;
    if (!isValidCoordinate(result.coordinate)) {
      developmentLog('GEOLOCATION ERROR', { code: 0, message: 'Browser returned invalid coordinates' });
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
  requestSource?: 'INITIAL_MAP' | 'CURRENT_LOCATION_BUTTON' | 'OTHER';
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
