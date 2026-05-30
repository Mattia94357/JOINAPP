import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';

const slides = [
  {
    title: 'Activity-first discovery',
    description: 'Curated plans for real people who want meaningful time, not endless swiping.',
  },
  {
    title: 'Premium experiences',
    description: 'Host and join local activities with effortless scheduling and trusted hosts.',
  },
  {
    title: 'Built for the moment',
    description: 'See what’s happening soon, claim your spot, and stay connected without the noise.',
  },
];

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const [current, setCurrent] = useState(0);

  const nextSlide = () => {
    if (current === slides.length - 1) {
      navigation.replace('Login');
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.inner}>
        <Text style={styles.brand}>JoinApp</Text>
        <Text style={styles.title}>{slides[current].title}</Text>
        <Text style={styles.description}>{slides[current].description}</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {slides.map((_, index) => (
            <View key={index} style={[styles.dot, current === index && styles.dotActive]} />
          ))}
        </View>
        <TouchableOpacity style={styles.button} onPress={nextSlide}>
          <Text style={styles.buttonText}>{current === slides.length - 1 ? 'Get started' : 'Next'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.replace('Login')}>
          <Text style={styles.skip}>Already have an account? Log in</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'space-between',
    padding: 24,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
  },
  brand: {
    color: '#f5c12d',
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 24,
  },
  title: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 42,
    maxWidth: '90%',
    marginBottom: 18,
  },
  description: {
    color: '#ddd',
    fontSize: 17,
    lineHeight: 26,
    maxWidth: '90%',
  },
  footer: {
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    marginBottom: 30,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: '#333',
    marginHorizontal: 6,
  },
  dotActive: {
    backgroundColor: '#f5c12d',
  },
  button: {
    backgroundColor: '#f5c12d',
    width: '100%',
    paddingVertical: 18,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 18,
  },
  buttonText: {
    color: '#050505',
    fontWeight: '800',
    fontSize: 16,
  },
  skip: {
    color: '#aaa',
    fontSize: 14,
  },
});
