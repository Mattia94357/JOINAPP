import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Marker } from 'react-native-maps';
import type { MapActivityMarkerProps } from './MapActivityMarker';
import { colors } from '../theme';
import { getMapActivityIconName } from '../utils/mapActivityIcons';

export default function MapActivityMarker({ activity, selected, onPress }: MapActivityMarkerProps) {
  const [tracksViewChanges, setTracksViewChanges] = useState(true);

  useEffect(() => {
    setTracksViewChanges(true);
    const timeout = setTimeout(() => setTracksViewChanges(false), 250);
    return () => clearTimeout(timeout);
  }, [selected]);

  return (
    <Marker
      coordinate={{ latitude: activity.latitude, longitude: activity.longitude }}
      onPress={onPress}
      tracksViewChanges={tracksViewChanges}
      anchor={{ x: 0.5, y: 1 }}
      accessibilityLabel={`${activity.title} activity`}
    >
      <View style={[styles.card, selected && styles.cardSelected]}>
        {activity.coverImage ? (
          <Image
            source={{ uri: activity.coverImage }}
            style={styles.image}
            onLoadEnd={() => setTracksViewChanges(false)}
          />
        ) : (
          <View style={styles.imageFallback} />
        )}
        <View style={styles.shadeLight} pointerEvents="none" />
        <View style={styles.shadeDeep} pointerEvents="none" />
        <View style={styles.iconBadge} pointerEvents="none">
          <Ionicons name={getMapActivityIconName(activity.category)} size={14} color={colors.primary} />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 60,
    height: 84,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.38)',
    backgroundColor: '#171717',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.48,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  cardSelected: {
    borderColor: colors.primary,
    transform: [{ scale: 1.09 }],
    elevation: 11,
  },
  image: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceElevated,
  },
  imageFallback: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.surfaceElevated,
  },
  shadeLight: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 46,
    backgroundColor: 'rgba(4,4,4,0.2)',
  },
  shadeDeep: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 25,
    backgroundColor: 'rgba(4,4,4,0.62)',
  },
  iconBadge: {
    position: 'absolute',
    left: 7,
    bottom: 7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,8,0.74)',
  },
});
