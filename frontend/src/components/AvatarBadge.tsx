import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

type Props = {
  name: string;
  avatarUrl?: string;
  size?: number;
};

const getInitials = (name: string) => {
  return name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
};

export default function AvatarBadge({ name, avatarUrl, size = 44 }: Props) {
  const initials = getInitials(name);
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}> 
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]} />
      ) : (
        <View style={[styles.placeholder, { width: size, height: size, borderRadius: size / 2 }]}> 
          <Text style={[styles.initials, { fontSize: size * 0.42 }]}>{initials}</Text>
        </View>
      )}
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
