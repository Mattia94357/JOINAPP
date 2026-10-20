export type Coordinate = { latitude: number; longitude: number };
export type CurrentRegion = Coordinate & { radiusKm: number; expiresAt: string; label?: string; geocodingAvailable?: boolean };
export type PlaceSuggestion = Coordinate & { id: string; name: string; label: string };
export const PASSPORT_MESSAGE = 'Passport Mode is required to host activities in another location.';
export const insideRegion = (region: CurrentRegion, point: Coordinate) => {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(point.latitude - region.latitude) / 2) ** 2
    + Math.cos(rad(region.latitude)) * Math.cos(rad(point.latitude)) * Math.sin(rad(point.longitude - region.longitude) / 2) ** 2;
  return Number.isFinite(h) && 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h))) <= region.radiusKm;
};

export const locationFailureMessage = (reason: string) => ({
  'permission-denied': 'Location permission denied. Allow location access in your browser settings, then retry.',
  'insecure-context': 'Location requires HTTPS or localhost. Open the secure JOIN website.',
  timeout: 'Finding your location timed out. Please retry.',
  unsupported: 'This browser does not support location access.',
}[reason] || 'Your device location is currently unavailable. Please retry.');

// A bounded, per-session cache and rolling request limit, shared between wizard mounts.
const cache = new Map<string, { until: number; places: PlaceSuggestion[] }>();
let requests: number[] = [];
export const cachedPlaceSearch = async (query: string, region: CurrentRegion, token: string,
  request: (query: string) => Promise<PlaceSuggestion[]>) => {
  if (query.trim().length < 3) return [];
  const key = `${token}:${region.latitude}:${region.longitude}:${query.trim().toLocaleLowerCase()}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.until > now) return hit.places;
  requests = requests.filter(time => time > now - 60000);
  if (requests.length >= 12) throw new Error('Too many place searches. Please wait a minute.');
  requests.push(now);
  const places = (await request(query.trim())).filter(place => insideRegion(region, place));
  if (cache.size >= 50) cache.delete(cache.keys().next().value!);
  cache.set(key, { places, until: now + 120000 });
  return places;
};
