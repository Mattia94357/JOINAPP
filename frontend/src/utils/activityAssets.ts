const categoryImages: Record<string, string> = {
  Adventure: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  Beach: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80',
  Coworking: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80',
  Culture: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
  'Dating & Singles': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
  Fitness: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1200&q=80',
  Food: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80',
  Music: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
  Networking: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
  Nightlife: 'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80',
  Other: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
  Sports: 'https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1200&q=80',
  Travel: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
  Wellness: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?auto=format&fit=crop&w=1200&q=80',
};

const defaultImages = [
  'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=1200&q=80',
  'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80',
];

export const getActivityCoverImage = (category?: string, id = '') => {
  if (category && categoryImages[category]) return categoryImages[category];
  const index = Math.abs(id.split('').reduce((total, char) => total + char.charCodeAt(0), 0)) % defaultImages.length;
  return defaultImages[index];
};

export const getVibeForCategory = (category?: string) => {
  const vibes: Record<string, string> = {
    Adventure: 'Active',
    Beach: 'Coastal',
    Coworking: 'Focused',
    Culture: 'Curious',
    'Dating & Singles': 'Meet through activities',
    Fitness: 'Energized',
    Food: 'Curated',
    Music: 'Live',
    Networking: 'Smart Social',
    Nightlife: 'Social',
    Other: 'Social',
    Sports: 'Team Energy',
    Travel: 'Exploratory',
    Wellness: 'Grounded',
  };

  return (category && vibes[category]) || 'Social';
};
