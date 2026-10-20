import express from 'express';
import { rateLimit } from 'express-rate-limit';
import auth, { AuthRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/asyncHandler';
import User from '../models/User';
import { DeviceRegion, loadCurrentRegion, REGION_RADIUS_KM, REGION_MAX_AGE_MS, freshDeviceCapture, validCoordinate } from '../services/currentRegion';
import { geocodingEnabled, providerGeocode, reserveGeocodingRequest } from '../services/placeSearch';

const router = express.Router();
router.use(auth);
router.use(rateLimit({ windowMs: 60000, limit: 40, standardHeaders: true, legacyHeaders: false }));
router.use(rateLimit({ windowMs: 60000, limit: 20, keyGenerator: (req: AuthRequest) => req.userId!,
  standardHeaders: true, legacyHeaders: false, message: { message: 'Too many place requests. Please wait a minute.' } }));
const paidRequestAllowed = async (userId: string) => geocodingEnabled()
  && await reserveGeocodingRequest(`user:${userId}`, 200) && await reserveGeocodingRequest();

router.post('/current', asyncHandler(async (req: AuthRequest<any, any, any>, res) => {
  const capturedAt: unknown = req.body?.capturedAt;
  if (!validCoordinate(req.body)) return res.status(400).json({ message: 'Valid device coordinates are required.' });
  if (!freshDeviceCapture(capturedAt)) return res.status(400).json({ message: 'A recent device location is required. Please retry location.' });
  const { latitude, longitude } = req.body;
  const previous = await loadCurrentRegion(req.userId);
  let label: string | undefined;
  // Reuse only a recent device-derived label for the same small area.
  if (previous && Math.abs(previous.latitude - latitude) < 0.01 && Math.abs(previous.longitude - longitude) < 0.01) label = previous.label;
  if (!label && await paidRequestAllowed(req.userId!)) {
    try { label = (await providerGeocode(`${longitude},${latitude}`))[0]?.label; }
    catch { console.warn('[location] Reverse geocoding unavailable'); }
  }
  const region = { latitude, longitude, radiusKm: REGION_RADIUS_KM, expiresAt: new Date(capturedAt + REGION_MAX_AGE_MS), observedAt: new Date(capturedAt), source: 'device', label };
  const { label: _label, ...regionCore } = region;
  await DeviceRegion.findByIdAndUpdate(req.userId, label
    ? { $set: region }
    : { $set: regionCore, $unset: { label: 1 } }, { upsert: true });
  await User.updateOne({ _id: req.userId }, label ? { $set: { location: label } } : { $unset: { location: 1 } });
  res.setHeader('Cache-Control', 'no-store');
  return res.json({ ...region, geocodingAvailable: geocodingEnabled() });
}));
router.get('/suggestions', asyncHandler(async (req: AuthRequest, res) => {
  const region = await loadCurrentRegion(req.userId);
  if (!region) return res.status(403).json({ message: 'Refresh your current device location before searching places.' });
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (q.length < 3 || q.length > 120) return res.status(400).json({ message: 'Enter between 3 and 120 characters.' });
  if (!geocodingEnabled()) return res.status(503).json({ message: 'Place search is not configured. You can select a local meeting point on the map.' });
  if (!await paidRequestAllowed(req.userId!)) return res.status(429).json({ message: 'Place search request budget reached. Please try later.' });
  try {
    res.setHeader('Cache-Control', 'no-store');
    return res.json(await providerGeocode(q, region));
  } catch { return res.status(503).json({ message: 'Place search is temporarily unavailable. Please retry or select on the map.' }); }
}));
export default router;
