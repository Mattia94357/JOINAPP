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
import { colors, spacing } from '../theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 0.25 * SCREEN_WIDTH;
const SWIPE_OUT_DURATION = 250;

type Props = {
  activities: Activity[];
  onSwipeLeft: (activity: Activity) => void;
  onSwipeRight: (activity: Activity) => void;
  onPress: (activity: Activity) => void;
  onViewParticipants?: (activity: Activity) => void;
  onOpenProfile?: (participant: { id?: string; name: string; avatar?: string }) => void;
};

export default function SwipeDeck({ activities, onSwipeLeft, onSwipeRight, onPress, onViewParticipants, onOpenProfile }: Props) {
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
          <Text style={styles.emptyText}>No more curated activities right now. Check back soon.</Text>
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
              <ActivityCard
                activity={activity}
                onPress={() => onPress(activity)}
                onViewParticipants={onViewParticipants}
                onOpenProfile={onOpenProfile}
              />
              <Animated.View style={[styles.overlay, { opacity: position.x.interpolate({
                inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
                outputRange: [1, 0, 0],
                extrapolate: 'clamp',
              }) }]}>
                <Text style={[styles.overlayText, styles.nope]}>SAVE</Text>
              </Animated.View>
              <Animated.View style={[styles.overlay, { opacity: position.x.interpolate({
                inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
                outputRange: [0, 0, 1],
                extrapolate: 'clamp',
              }) }]}>
                <Text style={[styles.overlayText, styles.like]}>JOIN</Text>
              </Animated.View>
            </Animated.View>
          );
        }

        return (
          <Animated.View
            key={activity.id}
            style={[styles.cardStyle, { top: 10 * (i - index), zIndex: -i }]}
          >
            <ActivityCard
              activity={activity}
              onPress={() => onPress(activity)}
              onViewParticipants={onViewParticipants}
              onOpenProfile={onOpenProfile}
            />
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
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderColor: colors.border,
    borderWidth: 1,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: spacing.xl,
    left: spacing.xl,
    zIndex: 10,
    padding: spacing.md,
    borderRadius: 8,
    borderWidth: 2,
  },
  overlayText: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  like: {
    color: colors.success,
    borderColor: colors.success,
    backgroundColor: 'rgba(116, 227, 154, 0.12)',
  },
  nope: {
    color: colors.danger,
    borderColor: colors.danger,
    backgroundColor: 'rgba(255, 107, 121, 0.12)',
  },
});
