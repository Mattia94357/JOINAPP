import React from 'react';
import { Image, ImageStyle, StyleSheet, View } from 'react-native';
import { getActivityCoverImage } from '../utils/activityAssets';

const images = [
  getActivityCoverImage('Food', 'app-atmosphere-food'),
  getActivityCoverImage('Nightlife', 'app-atmosphere-nightlife'),
  getActivityCoverImage('Adventure', 'app-atmosphere-adventure'),
  getActivityCoverImage('Beach', 'app-atmosphere-beach'),
];

/** A deliberately subdued version of the entry collage for screens that need to stay readable. */
export default function CinematicAppBackdrop() {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      {images.map((uri, index) => (
        <Image key={uri} source={{ uri }} style={[styles.tile, tilePositions[index]]} />
      ))}
      <View style={styles.overlay} />
    </View>
  );
}

const tilePositions: ImageStyle[] = [
  { left: '-18%', top: '-15%', transform: [{ rotate: '-16deg' }] },
  { right: '-20%', top: '-8%', transform: [{ rotate: '14deg' }] },
  { left: '-22%', bottom: '-18%', transform: [{ rotate: '12deg' }] },
  { right: '-18%', bottom: '-20%', transform: [{ rotate: '-14deg' }] },
];

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', backgroundColor: '#070707' },
  tile: { position: 'absolute', width: '58%', height: '58%', borderRadius: 28, opacity: 0.38, resizeMode: 'cover' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(5,5,5,0.74)' },
});
