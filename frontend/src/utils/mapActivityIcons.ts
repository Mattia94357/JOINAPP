import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';

export type MapActivityIconName = ComponentProps<typeof Ionicons>['name'];

const categoryIcons: Record<string, MapActivityIconName> = {
  Food: 'restaurant-outline',
  Drinks: 'wine-outline',
  Sports: 'football-outline',
  Adventure: 'compass-outline',
  Outdoors: 'compass-outline',
  Nightlife: 'musical-notes-outline',
  Music: 'musical-note-outline',
  Social: 'people-outline',
  Networking: 'people-outline',
  Wellness: 'leaf-outline',
  Fitness: 'fitness-outline',
  Beach: 'sunny-outline',
  Travel: 'airplane-outline',
  'Dating & Singles': 'heart-outline',
  Culture: 'color-palette-outline',
  Coworking: 'laptop-outline',
};

const ioniconGlyphs: Partial<Record<MapActivityIconName, number>> = {
  'airplane-outline': 61703,
  'color-palette-outline': 62039,
  'compass-outline': 62045,
  'fitness-outline': 62165,
  'football-outline': 62195,
  'heart-outline': 62267,
  'laptop-outline': 62315,
  'leaf-outline': 62321,
  'musical-note-outline': 62483,
  'musical-notes-outline': 62486,
  'people-outline': 62543,
  'restaurant-outline': 62687,
  'location-outline': 62339,
  'sunny-outline': 62795,
  'wine-outline': 62918,
};

export const getMapActivityIconName = (category?: string): MapActivityIconName =>
  categoryIcons[category || ''] || 'location-outline';

export const getMapActivityIconGlyph = (category?: string) =>
  String.fromCodePoint(ioniconGlyphs[getMapActivityIconName(category)] || 62339);
