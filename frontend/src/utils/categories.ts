export const activityCategories = [
  'Wellness',
  'Food',
  'Drinks',
  'Networking',
  'Outdoors',
  'Adventure',
  'Sports',
  'Fitness',
  'Beach',
  'Nightlife',
  'Travel',
  'Dating & Singles',
  'Culture',
  'Music',
  'Coworking',
  'Other',
];

export const normalizeActivityCategory = (category?: string) =>
  category && activityCategories.includes(category) ? category : 'Other';
