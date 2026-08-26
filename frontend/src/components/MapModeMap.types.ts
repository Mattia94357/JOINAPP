import type { Region } from 'react-native-maps';

export type MapActivity = {
  id: string;
  title: string;
  category: string;
  latitude: number;
  longitude: number;
  coverImage?: string;
};

export type MapModeMapProps = {
  initialRegion: Region;
  showsUserLocation: boolean;
  userCoordinate?: { latitude: number; longitude: number } | null;
  recenterRequest?: { latitude: number; longitude: number; requestId: number } | null;
  activities: MapActivity[];
  selectedActivityId: string;
  onSelectActivity: (activityId: string) => void;
  onSelectCluster?: (activityCount: number | null) => void;
  onViewportChange?: (region: Region) => void;
  mapTilerApiKey?: string;
  mapStyleId: string;
};
