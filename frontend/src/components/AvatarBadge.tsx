import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

type Props = {
  name: string;
  avatarUrl?: string;
  size?: number;
};

const getAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1E1E1E&color=F4C542&size=128`;

export default function AvatarBadge({ name, avatarUrl, size = 44 }: Props) {
  const imageUrl = avatarUrl || getAvatarUrl(name);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}> 
      <Image source={{ uri: imageUrl }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: colors.primary,
    fontWeight: '900',
  },
});
