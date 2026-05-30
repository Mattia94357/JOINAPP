import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import ActivityCard, { Activity } from './ActivityCard';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;
const SWIPE_OUT_DURATION = 250;

type Props = {
  activities: Activity[];
  onSwipeLeft: (activity: Activity) => void;
  onSwipeRight: (activity: Activity) => void;
  onPress: (activity: Activity) => void;
};

export default function SwipeDeck({ activities, onSwipeLeft, onSwipeRight, onPress }: Props) {
  const [index, setIndex] = useState(0);
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
  }, [index, position]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 10 || Math.abs(gesture.dy) > 10,
        onPanResponderMove: (_, gesture) => {
          position.setValue({ x: gesture.dx, y: gesture.dy });
        },
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > SWIPE_THRESHOLD) {
            forceSwipe('right', gesture.dy);
          } else if (gesture.dx < -SWIPE_THRESHOLD) {
            forceSwipe('left', gesture.dy);
          } else {
            resetPosition();
          }
        },
      }),
    [position],
  );

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-20deg', '0deg', '20deg'],
    });
    return {
      ...position.getLayout(),
      transform: [...position.getTranslateTransform(), { rotate }],
    };
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const onSwipeComplete = (direction: 'left' | 'right') => {
    const activity = activities[index];
    direction === 'right' ? onSwipeRight(activity) : onSwipeLeft(activity);
    Haptics.notificationAsync(
      direction === 'right' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
    position.setValue({ x: 0, y: 0 });
    setIndex((prev) => Math.min(prev + 1, activities.length));
  };

  const forceSwipe = (direction: 'left' | 'right', y: number) => {
    Animated.timing(position, {
      toValue: { x: direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH, y },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => onSwipeComplete(direction));
  };

  const renderCards = () => {
    if (index >= activities.length) {
      return (
        <View style={[styles.cardStyle, styles.emptyCard]} key="empty">
          <Text style={styles.emptyText}>No more events to swipe. Check back later for new activities.</Text>
        </View>
      );
    }

    return activities
      .map((activity, i) => {
        if (i < index) return null;

        if (i === index) {
          return (
            <Animated.View
              key={activity.id}
              style={[styles.cardStyle, getCardStyle()]}
              {...panResponder.panHandlers}
            >
              <ActivityCard activity={activity} onPress={() => onPress(activity)} />
              <Animated.View style={[styles.overlay, { opacity: position.x.interpolate({
                inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
                outputRange: [1, 0, 0],
                extrapolate: 'clamp',
              }) }]}>
                <Text style={[styles.overlayText, styles.nope]}>NOPE</Text>
              </Animated.View>
              <Animated.View style={[styles.overlay, { opacity: position.x.interpolate({
                inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
                outputRange: [0, 0, 1],
                extrapolate: 'clamp',
              }) }]}>
                <Text style={[styles.overlayText, styles.like]}>LIKE</Text>
              </Animated.View>
            </Animated.View>
          );
        }

        return (
          <Animated.View
            key={activity.id}
            style={[styles.cardStyle, { top: 10 * (i - index), zIndex: -i }]}
          >
            <ActivityCard activity={activity} onPress={() => onPress(activity)} />
          </Animated.View>
        );
      })
      .reverse();
  };

  return <View style={styles.container}>{renderCards()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cardStyle: {
    position: 'absolute',
    width: '100%',
  },
  emptyCard: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#111',
    borderRadius: 28,
    borderColor: '#333',
    borderWidth: 1,
  },
  emptyText: {
    color: '#eee',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 24,
    left: 24,
    zIndex: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
  },
  overlayText: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  like: {
    color: '#a1ff9d',
    borderColor: '#84d64c',
    backgroundColor: 'rgba(38, 166, 91, 0.14)',
  },
  nope: {
    color: '#ff6b79',
    borderColor: '#ff4a5c',
    backgroundColor: 'rgba(255, 107, 121, 0.12)',
  },
});
