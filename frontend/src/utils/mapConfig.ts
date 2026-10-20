import Constants from 'expo-constants';

const cleanValue = (value: unknown) => typeof value === 'string' && value.trim()
  ? value.trim()
  : undefined;

const extras = () => ({
  ...((Constants as any).manifest2?.extra?.expoClient?.extra || {}),
  ...((Constants.manifest as any)?.extra || {}),
  ...((Constants.expoConfig?.extra as any) || {}),
});

export const getMapTilerConfig = () => {
  const extra = extras();
  // Expo 48 Webpack exposes app.config.js extra through APP_MANIFEST.
  // EXPO_PUBLIC_* is not automatically injected into client process.env here.
  const manifestKey = cleanValue(extra.MAPTILER_API_KEY);
  const apiKey = manifestKey || cleanValue(process.env.EXPO_PUBLIC_MAPTILER_API_KEY);
  if (typeof __DEV__ !== 'undefined' && __DEV__) console.info('[JOIN map] key-configuration', {
    present: Boolean(apiKey), source: manifestKey ? 'expo-extra' : apiKey ? 'public-env' : 'missing',
    environment: ['production', 'preview', 'development'].includes(extra.MAPTILER_BUILD_ENV) ? extra.MAPTILER_BUILD_ENV : 'local',
  });
  return { apiKey, styleId: cleanValue(extra.MAPTILER_MAP_STYLE) || cleanValue(process.env.EXPO_PUBLIC_MAPTILER_MAP_STYLE) || 'streets-v4-dark' };
};

// Editing uses the same bounded, authenticated local search as creation.
export const geocodeActivityLocation = async (query: string, token: string) => {
  const { getCurrentJoinLocationResult } = await import('./locationService');
  const { registerCurrentRegionRequest, searchPlacesRequest } = await import('../api');
  const { cachedPlaceSearch, locationFailureMessage } = await import('./currentRegion');
  const result = await getCurrentJoinLocationResult({ retryDenied: true });
  if (result.status === 'failure') throw new Error(locationFailureMessage(result.reason));
  const response = await registerCurrentRegionRequest(result.coordinate, token, result.capturedAt);
  const places = await cachedPlaceSearch(query.slice(0, 120), response.data, token, q => searchPlacesRequest(q, token).then(r => r.data));
  if (!places[0]) throw new Error('Choose a local meeting point. Passport Mode is required to host activities in another location.');
  return { latitude: places[0].latitude, longitude: places[0].longitude };
};
