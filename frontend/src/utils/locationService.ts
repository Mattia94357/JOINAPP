import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import type { Region } from 'react-native-maps';

export type JoinCoordinate = { latitude: number; longitude: number };

const LAST_MAP_VIEWPORT_KEY = '@joinapp:last-map-viewport';
const CURRENT_LOCATION_MAX_AGE_MS = 60_000;
const LOCATION_TIMEOUT_MS = 8_000;

let cachedCurrentLocation: { coordinate: JoinCoordinate; capturedAt: number } | null = null;
let locationRequest: Promise<JoinCoordinate | null> | null = null;
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

const browserCurrentPosition = () => new Promise<JoinCoordinate | null>((resolve) => {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    resolve(null);
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
    (error) => {
      if (error.code === error.PERMISSION_DENIED) permissionDeniedThisSession = true;
      resolve(null);
    },
    { enableHighAccuracy: false, timeout: LOCATION_TIMEOUT_MS, maximumAge: 0 },
  );
});

const nativeCurrentPosition = async () => {
  const existingPermission = await Location.getForegroundPermissionsAsync();
  const permission = existingPermission.granted || !existingPermission.canAskAgain
    ? existingPermission
    : await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) {
    permissionDeniedThisSession = true;
    return null;
  }
  try {
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Location timed out')), LOCATION_TIMEOUT_MS)),
    ]);
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return null;
  }
};

export const getCurrentJoinLocation = async (options?: {
  forceRefresh?: boolean;
  retryDenied?: boolean;
}) => {
  const now = Date.now();
  if (
    !options?.forceRefresh
    && cachedCurrentLocation
    && now - cachedCurrentLocation.capturedAt <= CURRENT_LOCATION_MAX_AGE_MS
  ) return cachedCurrentLocation.coordinate;
  if (permissionDeniedThisSession && !options?.retryDenied) return null;
  if (locationRequest) return locationRequest;

  locationRequest = (async () => {
    const coordinate = Platform.OS === 'web'
      ? await browserCurrentPosition()
      : await nativeCurrentPosition();
    if (!isValidCoordinate(coordinate)) return null;
    cachedCurrentLocation = { coordinate, capturedAt: Date.now() };
    permissionDeniedThisSession = false;
    return coordinate;
  })().finally(() => {
    locationRequest = null;
  });

  return locationRequest;
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
