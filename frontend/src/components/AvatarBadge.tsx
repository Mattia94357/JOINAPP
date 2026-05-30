import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  avatarUrl?: string;
  size?: number;
};

const getAvatarUrl = (name: string) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111111&color=f5c12d&size=128`;

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
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    color: '#f5c12d',
    fontWeight: '900',
  },
});
