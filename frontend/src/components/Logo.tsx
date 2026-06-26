import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors } from '../theme';

type Props = {
  size?: number;
  withWordmark?: boolean;
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** JOIN's crossing-path mark. The two strokes intentionally meet as a single ribbon. */
export default function Logo({ size = 40, withWordmark = false, animate = false, style }: Props) {
  const leftPath = useRef(new Animated.Value(animate ? -0.26 * size : 0)).current;
  const rightPath = useRef(new Animated.Value(animate ? 0.26 * size : 0)).current;

  useEffect(() => {
    if (!animate) return;
    Animated.parallel([
      Animated.timing(leftPath, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(rightPath, { toValue: 0, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [animate, leftPath, rightPath]);

  return (
    <View style={[styles.lockup, style]} accessibilityRole="image" accessibilityLabel="JOIN">
      <View style={[styles.icon, { width: size, height: size, borderRadius: Math.max(10, size * 0.28) }]}>
        <Animated.View style={[styles.pathLayer, { transform: [{ translateX: leftPath }] }]}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path d="M13 61C13 45 31 38 43 49L65 70C71 76 79 77 87 77" fill="none" stroke={colors.primary} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <Animated.View style={[styles.pathLayer, { transform: [{ translateX: rightPath }] }]}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Path d="M87 17H78C69 17 65 23 65 33V48C65 65 53 78 36 78C26 78 18 72 13 62" fill="none" stroke={colors.primary} strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Animated.View>
      </View>
      {withWordmark ? <Text style={[styles.wordmark, { fontSize: Math.max(18, size * 0.58), letterSpacing: Math.max(1.5, size * 0.06) }]}>JOIN</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center' },
  icon: { overflow: 'hidden', backgroundColor: '#0B0B0B', alignItems: 'center', justifyContent: 'center' },
  pathLayer: { ...StyleSheet.absoluteFillObject },
  wordmark: { marginLeft: 10, color: colors.text, fontWeight: '900' },
});
