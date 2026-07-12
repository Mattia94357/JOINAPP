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
const SWIPE_THRESHOLD = Math.max(90, 0.25 * SCREEN_WIDTH);
const SWIPE_OUT_DURATION = 250;
const HORIZONTAL_START_DISTANCE = 12;
const HORIZONTAL_DOMINANCE = 1.2;
const FAST_SWIPE_VELOCITY = 0.65;
const FAST_SWIPE_DISTANCE = 35;

type Props = {
  activities: Activity[];
  onSwipeLeft: (activity: Activity) => boolean | void | Promise<boolean | void>;
  onSwipeRight: (activity: Activity) => boolean | void | Promise<boolean | void>;
  onSave?: (activity: Activity) => void;
  onPress: (activity: Activity) => void;
  onViewParticipants?: (activity: Activity) => void;
  onOpenProfile?: (participant: { id?: string; name: string; avatar?: string; profilePictureUrl?: string; profileThumbnailUrl?: string }) => void;
};

export default function SwipeDeck({
  activities,
  onSwipeLeft,
  onSwipeRight,
  onSave,
  onPress,
  onViewParticipants,
  onOpenProfile,
}: Props) {
  const [index, setIndex] = useState(0);
  const [isActing, setIsActing] = useState(false);
  const position = useRef(new Animated.ValueXY()).current;

  useEffect(() => {
    position.setValue({ x: 0, y: 0 });
  }, [index]);

  const isHorizontalGesture = (dx: number, dy: number) =>
    Math.abs(dx) > HORIZONTAL_START_DISTANCE && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_DOMINANCE;

  const shouldCompleteSwipe = (dx: number, vx: number) =>
    Math.abs(dx) >= SWIPE_THRESHOLD || (Math.abs(dx) >= FAST_SWIPE_DISTANCE && Math.abs(vx) >= FAST_SWIPE_VELOCITY);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onStartShouldSetPanResponderCapture: () => false,
        onMoveShouldSetPanResponder: (_, gesture) =>
          !isActing && isHorizontalGesture(gesture.dx, gesture.dy),
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !isActing && isHorizontalGesture(gesture.dx, gesture.dy),
        onShouldBlockNativeResponder: () => false,
        onPanResponderTerminationRequest: () => !isActing,
        onPanResponderMove: (_, gesture) => {
          if (isHorizontalGesture(gesture.dx, gesture.dy)) {
            position.setValue({ x: gesture.dx, y: Math.max(Math.min(gesture.dy, 28), -28) });
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (shouldCompleteSwipe(gesture.dx, gesture.vx)) {
            handleSwipe(gesture.dx > 0 ? 'right' : 'left', gesture.dy);
          } else {
            resetPosition();
          }
        },
        onPanResponderTerminate: () => resetPosition(),
      }),
    [isActing, position],
  );

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-SCREEN_WIDTH * 1.5, 0, SCREEN_WIDTH * 1.5],
      outputRange: ['-12deg', '0deg', '12deg'],
    });
    return {
      transform: [
        { translateX: position.x },
        { translateY: position.y },
        { rotate },
      ],
    };
  };

  const getFeedbackStyle = (direction: 'left' | 'right') => {
    const opacity = position.x.interpolate({
      inputRange: direction === 'right' ? [20, SWIPE_THRESHOLD] : [-SWIPE_THRESHOLD, -20],
      outputRange: direction === 'right' ? [0, 1] : [1, 0],
      extrapolate: 'clamp',
    });
    return { opacity };
  };

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 6,
    }).start();
  };

  const advanceCard = () => {
    position.setValue({ x: 0, y: 0 });
    setIndex((prev) => Math.min(prev + 1, activities.length));
  };

  const runSwipeAction = async (direction: 'left' | 'right', activity: Activity) => {
    const result = direction === 'right' ? await onSwipeRight(activity) : await onSwipeLeft(activity);
    return result !== false;
  };

  const finishSwipe = (direction: 'left' | 'right', y: number) => {
    Animated.timing(position, {
      toValue: { x: direction === 'right' ? SCREEN_WIDTH : -SCREEN_WIDTH, y: Math.max(Math.min(y, 28), -28) },
      duration: SWIPE_OUT_DURATION,
      useNativeDriver: true,
    }).start(() => {
      Haptics.notificationAsync(
        direction === 'right'
          ? Haptics.NotificationFeedbackType.Success
          : Haptics.NotificationFeedbackType.Warning,
      );
      advanceCard();
      setIsActing(false);
    });
  };

  const handleSwipe = async (direction: 'left' | 'right', y = 0) => {
    const activity = activities[index];
    if (!activity || isActing) return;

    setIsActing(true);
    try {
      const shouldAdvance = await runSwipeAction(direction, activity);
      if (shouldAdvance) {
        finishSwipe(direction, y);
      } else {
        resetPosition();
        setIsActing(false);
      }
    } catch (error) {
      resetPosition();
      setIsActing(false);
    }
  };

  const renderCards = () => {
    if (index >= activities.length) {
      return (
        <View style={[styles.cardStyle, styles.emptyCard]} key="empty">
          <Text style={styles.emptyText}>
            No more real plans nearby right now.
          </Text>
        </View>
      );
    }

    const activity = activities[index];

    return (
      <Animated.View
        key={activity.id}
        style={[styles.cardStyle, getCardStyle()]}
        {...panResponder.panHandlers}
      >
        <Animated.View style={[styles.feedbackBadge, styles.feedbackRight, getFeedbackStyle('right')]}>
          <Text style={styles.feedbackText}>Join</Text>
        </Animated.View>
        <Animated.View style={[styles.feedbackBadge, styles.feedbackLeft, getFeedbackStyle('left')]}>
          <Text style={styles.feedbackText}>Skip</Text>
        </Animated.View>
        <ActivityCard
          activity={activity}
          onPress={() => onPress(activity)}
          onSave={() => onSave?.(activity)}
          onViewParticipants={onViewParticipants}
          onOpenProfile={onOpenProfile}
        />
      </Animated.View>
    );
  };

  return <View style={styles.container}>{renderCards()}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    touchAction: 'pan-y' as any,
  },
  cardStyle: {
    flex: 1,
    minHeight: 0,
    height: '100%',
    position: 'relative',
    width: '100%',
    left: 0,
    right: 0,
    ...({ touchAction: 'pan-y' } as any),
  },
  feedbackBadge: {
    position: 'absolute',
    top: 24,
    zIndex: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(13,13,13,0.82)',
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  feedbackRight: {
    left: 18,
  },
  feedbackLeft: {
    right: 18,
  },
  feedbackText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyCard: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 16,
    textAlign: 'center',
  },
});
