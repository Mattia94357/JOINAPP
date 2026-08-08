import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { MapActivityMarkerProps } from './MapActivityMarker';
import { colors } from '../theme';

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
      anchor={{ x: 0.5, y: 0.5 }}
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
        <Text style={styles.title} numberOfLines={1}>{activity.title}</Text>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 142,
    height: 44,
    padding: 4,
    paddingRight: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.2)',
    backgroundColor: 'rgba(10,10,10,0.94)',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
  cardSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(18,17,12,0.97)',
  },
  image: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  imageFallback: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.surfaceElevated,
  },
  title: {
    flex: 1,
    minWidth: 0,
    marginLeft: 8,
    color: colors.text,
    fontSize: 11,
    fontWeight: '900',
  },
});
