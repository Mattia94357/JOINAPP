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
  styleId: cleanValue(extras().MAPTILER_MAP_STYLE || process.env.EXPO_PUBLIC_MAPTILER_MAP_STYLE) || 'dataviz-dark',
});

type GeocodingResponse = {
  features?: Array<{ center?: [number, number] }>;
};

export const geocodeActivityLocation = async (query: string) => {
  const { apiKey } = getMapTilerConfig();
  if (!apiKey) throw new Error('Map location services are not configured.');

  const response = await fetch(
    `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${encodeURIComponent(apiKey)}&language=en&limit=1`,
  );
  if (!response.ok) throw new Error('Unable to resolve this activity location.');

  const data = await response.json() as GeocodingResponse;
  const [longitude, latitude] = data.features?.[0]?.center || [];
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Choose a more specific activity location.');
  }

  return { latitude: latitude as number, longitude: longitude as number };
};
