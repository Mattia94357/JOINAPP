import { Schema, model } from 'mongoose';
import { Coordinate, CurrentRegion, insideRegion, validCoordinate } from './currentRegion';

const budgetSchema = new Schema({ _id: String, count: Number, expiresAt: Date });
budgetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const Budget = model('GeocodingBudget', budgetSchema);
export const geocodingEnabled = () => process.env.LOCATION_GEOCODING_ENABLED === 'true'
  && Boolean(process.env.MAPTILER_SERVER_API_KEY);

// Atomic, shared across replicas. Fail closed if the budget store is unavailable.
export const reserveGeocodingRequest = async (scope = 'global', cap = 1000) => {
  const day = new Date().toISOString().slice(0, 10);
  const _id = `${scope}:${day}`;
  try {
    await Budget.updateOne({ _id }, { $setOnInsert: { count: 0, expiresAt: new Date(Date.now() + 172800000) } }, { upsert: true });
  } catch (error: any) { if (error?.code !== 11000) throw error; }
  return Boolean(await Budget.findOneAndUpdate({ _id, count: { $lt: cap } }, { $inc: { count: 1 } }));
};
export const providerGeocode = async (query: string, region?: CurrentRegion) => {
  const params = new URLSearchParams({ key: process.env.MAPTILER_SERVER_API_KEY!, language: 'en', limit: region ? '6' : '1' });
  if (region) {
    params.set('proximity', `${region.longitude},${region.latitude}`);
    // Bounding box is an optimization; haversine filtering below is authoritative.
    const dy = region.radiusKm / 111;
    const dx = Math.min(180, dy / Math.max(0.01, Math.cos(region.latitude * Math.PI / 180)));
    if (region.longitude - dx >= -180 && region.longitude + dx <= 180) {
      params.set('bbox', [region.longitude - dx, Math.max(-90, region.latitude - dy), region.longitude + dx, Math.min(90, region.latitude + dy)].join(','));
    }
  } else params.set('types', 'municipality,region,country');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?${params}`, { signal: controller.signal });
    if (!response.ok) throw new Error('Place provider unavailable');
    const data: any = await response.json();
    return (data.features || []).map((feature: any) => ({
      id: String(feature.id || feature.place_name), name: String(feature.text || feature.place_name || '').slice(0, 120),
      label: String(feature.place_name || feature.text || '').slice(0, 120),
      latitude: feature.center?.[1], longitude: feature.center?.[0],
    })).filter((place: Coordinate) => validCoordinate(place) && (!region || insideRegion(region, place))).slice(0, 6);
  } finally { clearTimeout(timer); }
};
