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
  activities: MapActivity[];
  selectedActivityId: string;
  onSelectActivity: (activityId: string) => void;
  onSelectCluster?: (activityCount: number | null) => void;
  mapTilerApiKey?: string;
  mapStyleId: string;
};
