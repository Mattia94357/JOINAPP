import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import connectDb from '../config/db';
import Activity from '../models/Activity';
import User from '../models/User';

dotenv.config();

const seedTag = 'join-demo';
const demoPassword = process.env.DEMO_SEED_PASSWORD || 'JoinDemo123';

const demoUsers = [
  ['Marco Bianchi', 'Food host, pizza obsessive, easy conversation.'],
  ['Sofia Rossi', 'Morning runner and beach sunrise regular.'],
  ['Alex Kim', 'Builder, designer, co-working café person.'],
  ['Liam Carter', 'Board games, calm nights, excellent snacks.'],
  ['Emma Watson', 'Kayaks, coastlines, and gentle adventures.'],
  ['Olivia Green', 'Wellness host, yoga, breathwork, good energy.'],
  ['Noah Bennett', 'Wine bars, new friends, old records.'],
  ['Mia Chen', 'Pilates, matcha, galleries, weekend plans.'],
  ['Ethan Brooks', 'Social football and post-game food.'],
  ['Ava Patel', 'Rooftops, restaurants, thoughtful hosting.'],
  ['Lucas Stone', 'Hiking guide and sunset chaser.'],
  ['Isabella Moore', 'Creative networking and founder circles.'],
  ['Henry Wilson', 'Live music, jazz bars, low-lit rooms.'],
  ['Amelia Clarke', 'Brunch host and neighbourhood explorer.'],
  ['Jack Taylor', 'Cycling groups and coffee afterwards.'],
  ['Grace Martin', 'Books, wine, and relaxed dinner parties.'],
  ['Leo Anderson', 'Climbing, outdoors, and weekend escapes.'],
  ['Zoe Walker', 'Night markets and hidden cocktail spots.'],
  ['Mason Hall', 'Tennis, sport socials, and casual competition.'],
  ['Lily Young', 'Mindfulness walks and wellness circles.'],
  ['Aria Scott', 'Design meetups and creative salons.'],
  ['Finn Cooper', 'Sea swims and coastal breakfasts.'],
  ['Ruby King', 'Food pop-ups and cosy restaurants.'],
  ['Oscar Wright', 'Trivia nights and relaxed drinks.'],
  ['Ella Hughes', 'Gallery nights and cultural walks.'],
  ['Theo Morris', 'Startup coffee chats and maker sessions.'],
];

const activityTemplates = [
  ['Pizza & Wine Night 🍕', 'Food', 'Perth CBD', 'Share wood-fired pizza, wine, and easy conversation in the city.', 7, 4, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=1200&q=85'],
  ['Sunrise Beach Run 🏃', 'Sports', 'Cottesloe Beach', 'Start the day with a relaxed run and ocean air.', 6, 8, 'https://images.unsplash.com/photo-1502904550040-7534597429ae?auto=format&fit=crop&w=1200&q=85'],
  ['Coffee & Work ☕', 'Networking', 'Northbridge', 'Bring your laptop and make progress with good people nearby.', 3, 5, 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=85'],
  ['Board Games Night 🎲', 'Nightlife', 'Subiaco', 'A cosy night of games, snacks, and friendly competition.', 5, 3, 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=1200&q=85'],
  ['Kayaking Adventure 🛶', 'Outdoors', 'Matilda Bay', 'Paddle the bay and enjoy calm water with a small group.', 3, 6, 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=85'],
  ['Yoga in the Park 🧘', 'Wellness', 'Kings Park', 'Gentle movement, quiet breathing, and golden morning light.', 7, 6, 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=85'],
  ['Hidden Cocktail Bar 🍸', 'Drinks', 'Northbridge', 'Discover a low-lit cocktail spot with a relaxed table.', 4, 4, 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&w=1200&q=85'],
  ['Founder Breakfast', 'Networking', 'Elizabeth Quay', 'Meet builders and founders over a sharp morning coffee.', 5, 5, 'https://images.unsplash.com/photo-1559329007-40df8a9345d8?auto=format&fit=crop&w=1200&q=85'],
  ['Social Tennis Rally 🎾', 'Sports', 'Leederville', 'Casual doubles, laughs, and a drink afterwards.', 4, 4, 'https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1200&q=85'],
  ['Sunset Picnic', 'Food', 'Kings Park', 'A curated picnic with city views and warm conversation.', 6, 5, 'https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?auto=format&fit=crop&w=1200&q=85'],
  ['Ocean Swim Club', 'Wellness', 'Scarborough', 'A gentle group swim followed by breakfast near the beach.', 8, 6, 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=85'],
  ['Live Jazz Table 🎷', 'Nightlife', 'Perth CBD', 'A small table for live jazz, drinks, and new company.', 4, 4, 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=1200&q=85'],
  ['Fremantle Food Crawl', 'Food', 'Fremantle', 'Taste a few neighbourhood favourites with a relaxed group.', 5, 7, 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=85'],
  ['Mindful Walk', 'Wellness', 'Matilda Bay', 'Slow walk, quiet chats, and a reset by the water.', 6, 6, 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?auto=format&fit=crop&w=1200&q=85'],
  ['Rooftop Sundowners', 'Drinks', 'Perth CBD', 'Golden-hour drinks on a rooftop with an intimate crew.', 5, 5, 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=85'],
  ['Trail Hike & Brunch', 'Outdoors', 'Kings Park', 'A scenic trail walk ending with brunch nearby.', 7, 5, 'https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&w=1200&q=85'],
  ['Creative Salon', 'Networking', 'Subiaco', 'Designers and makers sharing ideas in a calm lounge.', 4, 6, 'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1200&q=85'],
  ['Trivia & Tapas', 'Nightlife', 'Leederville', 'A fun trivia table with shared plates and low pressure.', 6, 4, 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=85'],
] as const;

const activityCoordinates: Record<string, { latitude: number; longitude: number }> = {
  'Perth CBD': { latitude: -31.9523, longitude: 115.8613 },
  'Cottesloe Beach': { latitude: -31.9949, longitude: 115.7511 },
  Northbridge: { latitude: -31.9475, longitude: 115.8587 },
  Subiaco: { latitude: -31.9486, longitude: 115.8242 },
  'Matilda Bay': { latitude: -31.9778, longitude: 115.8249 },
  'Kings Park': { latitude: -31.9617, longitude: 115.8324 },
  'Elizabeth Quay': { latitude: -31.9587, longitude: 115.8575 },
  Leederville: { latitude: -31.9364, longitude: 115.8419 },
  Scarborough: { latitude: -31.8958, longitude: 115.7572 },
  Fremantle: { latitude: -32.0569, longitude: 115.7439 },
};

const avatarFor = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111111&color=F6C445&size=256&bold=true`;

async function seedDemoData() {
  await connectDb();

  const hashedPassword = await bcrypt.hash(demoPassword, 10);
  await Activity.deleteMany({ inviteCode: seedTag });
  await User.deleteMany({ email: new RegExp(`^${seedTag}\\+`) });

  const users = await User.insertMany(
    demoUsers.map(([name, bio], index) => ({
      name,
      email: `${seedTag}+user${index + 1}@join.local`,
      password: hashedPassword,
      avatar: avatarFor(name),
      profilePictureUrl: avatarFor(name),
      profileThumbnailUrl: avatarFor(name),
      profileCompleted: true,
      verified: index % 3 === 0,
      bio,
      aboutMe: bio,
      interests: ['Food', 'Drinks', 'Sports', 'Outdoors', 'Wellness', 'Networking'].slice(index % 4, (index % 4) + 3),
      hostRating: 4.6 + (index % 5) / 10,
      reviewCount: 6 + index,
      hostedCount: 1 + (index % 8),
      joinedCount: 3 + (index % 10),
    })),
  );

  const userIds = users.map((user) => user._id as Types.ObjectId);
  const now = Date.now();

  await Activity.insertMany(
    activityTemplates.map(([title, category, location, description, attendeeCount, spotsLeft, coverImage], index) => {
      const host = userIds[index % userIds.length];
      const participantIds = userIds
        .filter((id) => !id.equals(host))
        .slice(index % 8, (index % 8) + attendeeCount);
      return {
        title,
        category,
        location,
        locationName: location,
        ...activityCoordinates[location],
        description,
        host,
        participants: participantIds,
        date: new Date(now + (index + 1) * 24 * 60 * 60 * 1000 + (index % 4) * 90 * 60 * 1000),
        coverImage,
        maxAttendees: attendeeCount + spotsLeft,
        availabilityTag: index < 3 ? 'This week' : 'Upcoming',
        vibe: ['Cinematic', 'Social', 'Curated', 'Easy-going'][index % 4],
        visibility: 'public',
        joinApproval: 'auto',
        status: 'active',
        inviteCode: seedTag,
      };
    }),
  );

  console.log(`[seed] Created ${users.length} demo users and ${activityTemplates.length} demo activities.`);
  await mongoose.disconnect();
}

seedDemoData().catch(async (error) => {
  console.error('[seed] Demo data seed failed:', error instanceof Error ? error.message : 'Unknown error');
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
