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
      <View style={styles.markerWrap}>
        <View style={[styles.tip, selected && styles.tipSelected]} />
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
        <View style={styles.iconBadge} pointerEvents="none">
          <Ionicons name={getMapActivityIconName(activity.category)} size={11} color={colors.primary} />
        </View>
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  markerWrap: {
    width: 46,
    height: 54,
    alignItems: 'center',
  },
  tip: {
    position: 'absolute',
    bottom: 2,
    width: 16,
    height: 16,
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#171713',
    transform: [{ rotate: '45deg' }],
  },
  tipSelected: {
    borderColor: '#fff',
  },
  card: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#171717',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.48,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  cardSelected: {
    borderColor: '#fff',
    transform: [{ scale: 1.1 }],
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
  iconBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(8,8,8,0.74)',
  },
});
