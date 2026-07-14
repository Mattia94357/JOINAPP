import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { colors } from '../theme';

type Props = {
  coordinate: { latitude: number; longitude: number };
  approximate: boolean;
};

const darkMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#aaa69a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#171715' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#39372f' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#24231f' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111a1d' }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
] as any;

export default function InteractiveLocationMap({ coordinate, approximate }: Props) {
  const regionDelta = approximate ? 0.12 : 0.045;
  const pinEntrance = useRef(new Animated.Value(0)).current;
  const [pinTracksChanges, setPinTracksChanges] = useState(true);

  useEffect(() => {
    Animated.spring(pinEntrance, {
      toValue: 1,
      speed: 20,
      bounciness: 5,
      useNativeDriver: true,
    }).start(() => setPinTracksChanges(false));
  }, [pinEntrance]);

  return (
    <MapView
      key={`${coordinate.latitude}-${coordinate.longitude}-${approximate}`}
      style={StyleSheet.absoluteFill}
      initialRegion={{ ...coordinate, latitudeDelta: regionDelta, longitudeDelta: regionDelta }}
      customMapStyle={darkMapStyle}
      zoomEnabled
      scrollEnabled
      pitchEnabled={false}
      rotateEnabled={false}
      toolbarEnabled={false}
      moveOnMarkerPress={false}
    >
      <Marker coordinate={coordinate} tracksViewChanges={pinTracksChanges}>
        <Animated.View style={[
          styles.pinCircle,
          {
            opacity: pinEntrance,
            transform: [
              { translateY: pinEntrance.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) },
              { scale: pinEntrance.interpolate({ inputRange: [0, 0.82, 1], outputRange: [0.92, 1.04, 1] }) },
            ],
          },
        ]}>
          <Ionicons name="location" size={28} color={colors.primary} />
        </Animated.View>
      </Marker>
    </MapView>
  );
}

const styles = StyleSheet.create({
  pinCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,9,0.92)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
});
