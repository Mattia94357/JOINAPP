import React from 'react';
import type { MapActivity } from './MapModeMap.types';

export type MapActivityMarkerProps = {
  activity: MapActivity;
  selected: boolean;
  onPress: () => void;
};

// Native platforms resolve MapActivityMarker.native.tsx. This keeps TypeScript
// and non-native resolution explicit without introducing a fake web marker.
export default function MapActivityMarker(_props: MapActivityMarkerProps) {
  return null;
}
