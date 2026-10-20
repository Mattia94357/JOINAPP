import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';
import { reportFrontendError } from './safeError';

export type JoinCoordinate = { latitude: number; longitude: number };
export type JoinPlaceResult = JoinLocationResult & { place?: string; placeError?: string };

export type JoinLocationResult = {
  status: 'success';
  coordinate: JoinCoordinate;
  accuracy: number | null;
  capturedAt: number;
} | {
  status: 'failure';
  reason: 'permission-denied' | 'position-unavailable' | 'timeout' | 'unsupported' | 'insecure-context' | 'unknown';
  errorCode?: number;
  errorMessage?: string;
};

const LAST_MAP_VIEWPORT_KEY = '@joinapp:last-map-viewport';
const CURRENT_LOCATION_MAX_AGE_MS = 60_000;
const LOCATION_TIMEOUT_MS = 15_000;

let cachedCurrentLocation: { result: Extract<JoinLocationResult, { status: 'success' }>; capturedAt: number } | null = null;
let locationRequest: Promise<JoinLocationResult> | null = null;
let permissionDeniedThisSession = false;
let requestSequence = 0;

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

const browserCurrentPosition = (fresh: boolean): Promise<JoinLocationResult> => {
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    return Promise.resolve({ status: 'failure', reason: 'insecure-context' });
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve({
      status: 'failure',
      reason: 'unsupported',
      errorMessage: 'navigator.geolocation is unavailable',
    });
  }

  // Permissions API is advisory only. Safari may not implement this descriptor,
  // and site permission does not describe every OS/policy restriction.
  let permissionState = typeof navigator.permissions?.query === 'function' ? 'pending' : 'unavailable';
  let outcome: { errorCode: number | null; category: string } | undefined;
  const diagnose = () => { if (outcome) console.info('[JOIN location] geolocation-result', { ...outcome, permissionState }); };
  try {
    if (typeof navigator.permissions?.query === 'function') void navigator.permissions.query({ name: 'geolocation' }).then(permission => {
      permissionState = ['granted', 'denied', 'prompt'].includes(permission.state) ? permission.state : 'unknown';
      diagnose();
    }).catch(() => { permissionState = 'unavailable'; diagnose(); });
  } catch { permissionState = 'unavailable'; }
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
          capturedAt: Number.isFinite(position.timestamp) ? position.timestamp : Date.now(),
        };
        outcome = { errorCode: null, category: 'success' }; diagnose();
        resolve(result);
      },
      (error) => {
        if (error.code === 1) permissionDeniedThisSession = true;
        const reason = error.code === 1
          ? 'permission-denied'
          : error.code === 2
            ? 'position-unavailable'
            : error.code === 3
              ? 'timeout'
              : 'unknown';
        outcome = { errorCode: Number.isInteger(error.code) ? error.code : null, category: reason }; diagnose();
        resolve({
          status: 'failure',
          reason,
          errorCode: error.code,
          errorMessage: error.message,
        });
      },
      { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: fresh ? 0 : CURRENT_LOCATION_MAX_AGE_MS },
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
      capturedAt: position.timestamp,
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
    && now - cachedCurrentLocation.result.capturedAt <= CURRENT_LOCATION_MAX_AGE_MS
  ) return cachedCurrentLocation.result;
  if (permissionDeniedThisSession && Platform.OS !== 'web' && !options?.retryDenied) {
    return { status: 'failure', reason: 'permission-denied' };
  }
  if (locationRequest && !options?.forceRefresh) return locationRequest;

  const sequence = ++requestSequence;
  const pendingRequest: Promise<JoinLocationResult> = (async (): Promise<JoinLocationResult> => {
    const result = Platform.OS === 'web'
      ? await browserCurrentPosition(Boolean(options?.forceRefresh))
      : await nativeCurrentPosition();
    if (result.status === 'failure') {
      if (sequence === requestSequence) cachedCurrentLocation = null;
      return result;
    }
    if (!isValidCoordinate(result.coordinate) || !Number.isFinite(result.capturedAt) || Date.now() - result.capturedAt > 120_000 || result.capturedAt > Date.now() + 30_000) {
      if (sequence === requestSequence) cachedCurrentLocation = null;
      console.info('[JOIN location] geolocation-validation', { category: 'stale-or-invalid-position' });
      return {
        status: 'failure',
        reason: 'position-unavailable',
        errorMessage: 'Device returned an invalid or stale position. Retry location.',
      };
    }
    if (sequence === requestSequence) cachedCurrentLocation = { result, capturedAt: Date.now() };
    permissionDeniedThisSession = false;
    return result;
  })().catch((error): JoinLocationResult => {
    if (sequence === requestSequence) cachedCurrentLocation = null;
    reportFrontendError('geolocation_request_failed', error);
    return { status: 'failure', reason: 'unknown' };
  }).finally(() => {
    if (locationRequest === pendingRequest) locationRequest = null;
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

export const getCurrentJoinPlaceResult = async (options?: {
  forceRefresh?: boolean;
  retryDenied?: boolean;
  token?: string;
}): Promise<JoinPlaceResult> => {
  const result = await getCurrentJoinLocationResult(options);
  if (result.status === 'failure') return result;
  if (Platform.OS === 'web') {
    if (!options?.token) return result;
    try {
      const { registerCurrentRegionRequest } = await import('../api');
      const response = await registerCurrentRegionRequest(result.coordinate, options.token, result.capturedAt);
      return { ...result, place: response.data.label, placeError: response.data.label ? undefined : response.data.geocodingAvailable === false ? 'Location found. Place labels are not configured on the server.' : 'Location found. The place label service is temporarily unavailable.' };
    } catch (error) {
      reportFrontendError('current_region_sync_failed', error);
      return result;
    }
  }
  try {
    const [address] = await Location.reverseGeocodeAsync(result.coordinate);
    const parts = [address?.city || address?.district || address?.subregion, address?.region, address?.country]
      .filter((part, index, all): part is string => Boolean(part) && all.indexOf(part) === index);
    const place = parts.join(', ');
    return { ...result, place: place || undefined };
  } catch (error) {
    reportFrontendError('reverse_geocode_failed', error);
    return result;
  }
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
    await AsyncStorage.setItem(LAST_MAP_VIEWPORT_KEY, JSON.stringify({ ...localViewport, savedAt: Date.now() }));
  } catch {
    // A map viewport is a convenience only; storage failure must not block discovery.
  }
};
