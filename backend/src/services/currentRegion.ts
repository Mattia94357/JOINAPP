import { Schema, model } from 'mongoose';

export type Coordinate = { latitude: number; longitude: number };
export type CurrentRegion = Coordinate & { radiusKm: number; expiresAt: Date; label?: string };
export const PASSPORT_MESSAGE = 'Passport Mode is required to host activities in another location.';
export const REGION_RADIUS_KM = 50;
const schema = new Schema({
  _id: String, latitude: Number, longitude: Number, radiusKm: Number, expiresAt: Date, label: String,
});
schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const DeviceRegion = model('DeviceRegion', schema);
export const validCoordinate = (p: any): p is Coordinate => typeof p?.latitude === 'number'
  && typeof p?.longitude === 'number' && Number.isFinite(p.latitude) && Number.isFinite(p.longitude)
  && Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
export const distanceKm = (a: Coordinate, b: Coordinate) => {
  const rad = (n: number) => n * Math.PI / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};
export const insideRegion = (region: CurrentRegion, p: Coordinate) => validCoordinate(p)
  && distanceKm(region, p) <= region.radiusKm;
export const loadCurrentRegion = async (userId?: string): Promise<CurrentRegion | null> => {
  if (!userId) return null;
  return DeviceRegion.findOne({ _id: userId, expiresAt: { $gt: new Date() } }).lean() as any;
};
export const locationIssue = (region: CurrentRegion | null, p: Coordinate) => !region
  ? 'Refresh your current device location before continuing.'
  : !insideRegion(region, p) ? PASSPORT_MESSAGE : undefined;

// Filter before pagination so remote activities cannot displace local results.
// Compare unit-vector dot products to avoid needing an additional coordinate field/index.
export const regionActivityFilter = (region: CurrentRegion) => {
  const lat = region.latitude * Math.PI / 180;
  const lon = region.longitude * Math.PI / 180;
  const activityLat = { $degreesToRadians: '$latitude' };
  const activityLon = { $degreesToRadians: '$longitude' };
  return {
    latitude: { $gte: Math.max(-90, region.latitude - region.radiusKm / 110), $lte: Math.min(90, region.latitude + region.radiusKm / 110) },
    longitude: { $gte: -180, $lte: 180 },
    $expr: { $gte: [
      { $add: [
        { $multiply: [Math.sin(lat), { $sin: activityLat }] },
        { $multiply: [Math.cos(lat), { $cos: activityLat }, { $cos: { $subtract: [activityLon, lon] } }] },
      ] }, Math.cos(region.radiusKm / 6371),
    ] },
  };
};
