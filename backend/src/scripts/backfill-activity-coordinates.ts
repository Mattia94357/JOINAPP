import dotenv from 'dotenv';
import mongoose from 'mongoose';
import connectDb from '../config/db';
import Activity from '../models/Activity';

dotenv.config();

type GeocodingResponse = {
  features?: Array<{ center?: [number, number] }>;
};

async function backfillActivityCoordinates() {
  const apiKey = process.env.MAPTILER_API_KEY;
  if (!apiKey) throw new Error('MAPTILER_API_KEY is required.');

  await connectDb();
  const activities = await Activity.find({
    $or: [
      { latitude: { $exists: false } },
      { longitude: { $exists: false } },
      { latitude: null },
      { longitude: null },
    ],
  });

  let updated = 0;
  for (const activity of activities) {
    const query = encodeURIComponent(activity.location);
    const response = await fetch(`https://api.maptiler.com/geocoding/${query}.json?key=${encodeURIComponent(apiKey)}&language=en&limit=1`);
    if (!response.ok) {
      console.warn(`[coordinates] ${activity.title}: geocoder returned ${response.status}`);
      continue;
    }

    const data = await response.json() as GeocodingResponse;
    const [longitude, latitude] = data.features?.[0]?.center || [];
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      console.warn(`[coordinates] ${activity.title}: no reliable result for "${activity.location}"`);
      continue;
    }

    activity.latitude = latitude;
    activity.longitude = longitude;
    activity.locationName = activity.locationName || activity.location;
    await activity.save();
    updated += 1;
  }

  console.log(`[coordinates] Updated ${updated} of ${activities.length} activities.`);
  await mongoose.disconnect();
}

backfillActivityCoordinates().catch(async (error) => {
  console.error('[coordinates] Backfill failed:', error instanceof Error ? error.message : 'Unknown error');
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
