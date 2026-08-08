import React from 'react';
import { StyleSheet } from 'react-native';
import MapView from 'react-native-maps';
import MapActivityMarker from './MapActivityMarker';
import type { MapModeMapProps } from './MapModeMap.types';

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1b1d1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#aaa69a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#141613' }] },
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#34362f' }] },
  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: '#1b1d1a' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#35372f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#252720' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#4a4533' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#10191c' }] },
] as any;

export default function MapModeMap({
  initialRegion,
  showsUserLocation,
  activities,
  selectedActivityId,
  onSelectActivity,
}: MapModeMapProps) {
  return (
    <MapView
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      customMapStyle={darkMapStyle}
      userInterfaceStyle="dark"
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
      zoomEnabled
      zoomTapEnabled
      scrollEnabled
      pitchEnabled
      rotateEnabled
      loadingEnabled
      loadingBackgroundColor="#111310"
      loadingIndicatorColor="#F6C445"
      accessibilityLabel="Interactive map"
    >
      {activities.map((activity) => (
        <MapActivityMarker
          key={activity.id}
          activity={activity}
          selected={activity.id === selectedActivityId}
          onPress={() => onSelectActivity(activity.id)}
        />
      ))}
    </MapView>
  );
}
