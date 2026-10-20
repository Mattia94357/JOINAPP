import Constants from 'expo-constants';

const cleanValue = (value: unknown) => typeof value === 'string' && value.trim()
  ? value.trim()
  : undefined;

const extras = () => (
  (Constants.expoConfig?.extra as any)
  || (Constants.manifest as any)?.extra
  || (Constants as any).manifest2?.extra?.expoClient?.extra
  || {}
);

export const getMapTilerConfig = () => ({
  apiKey: cleanValue(extras().MAPTILER_API_KEY || process.env.EXPO_PUBLIC_MAPTILER_API_KEY),
  styleId: cleanValue(extras().MAPTILER_MAP_STYLE || process.env.EXPO_PUBLIC_MAPTILER_MAP_STYLE) || 'streets-v4-dark',
});

// Editing uses the same bounded, authenticated local search as creation.
export const geocodeActivityLocation = async (query: string, token: string) => {
  const { getCurrentJoinLocationResult } = await import('./locationService');
  const { registerCurrentRegionRequest, searchPlacesRequest } = await import('../api');
  const { cachedPlaceSearch, locationFailureMessage } = await import('./currentRegion');
  const result = await getCurrentJoinLocationResult({ retryDenied: true });
  if (result.status === 'failure') throw new Error(locationFailureMessage(result.reason));
  const response = await registerCurrentRegionRequest(result.coordinate, token);
  const places = await cachedPlaceSearch(query.slice(0, 120), response.data, token, q => searchPlacesRequest(q, token).then(r => r.data));
  if (!places[0]) throw new Error('Choose a local meeting point. Passport Mode is required to host activities in another location.');
  return { latitude: places[0].latitude, longitude: places[0].longitude };
};
