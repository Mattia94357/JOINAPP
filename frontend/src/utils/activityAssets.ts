const categoryImages: Record<string, string> = {
  Adventure: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80',
  Food: 'https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=1200&q=80',
  Networking: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=80',
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
    Food: 'Curated',
    Networking: 'Smart Social',
    Wellness: 'Grounded',
  };

  return (category && vibes[category]) || 'Social';
};
