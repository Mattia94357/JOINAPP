import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useMessaging } from '../context/MessagingContext';
import { colors } from '../theme';

type BottomNavTab = 'discover' | 'host' | 'notifications' | 'messages' | 'profile';

export const BOTTOM_NAV_HEIGHT = 54;
export const BOTTOM_NAV_CONTENT_GAP = 16;
export const getBottomNavigationClearance = (bottomInset: number) =>
  BOTTOM_NAV_HEIGHT + bottomInset + BOTTOM_NAV_CONTENT_GAP;
export const BOTTOM_NAV_WEB_CONTENT_CLEARANCE =
  `calc(${BOTTOM_NAV_HEIGHT + BOTTOM_NAV_CONTENT_GAP}px + env(safe-area-inset-bottom))` as any;

type BottomNavIconProps = {
  active: boolean;
  accessibilityLabel: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  badgeCount?: number;
};

const activeTabByRoute: Partial<Record<keyof RootStackParamList, BottomNavTab>> = {
  Home: 'discover',
  CreateActivity: 'host',
  Notifications: 'notifications',
  Chat: 'messages',
  Messages: 'messages',
  MessageRequests: 'messages',
  Profile: 'profile',
};

function BottomNavIcon({ active, accessibilityLabel, icon, onPress, badgeCount = 0 }: BottomNavIconProps) {
  const pressProgress = useRef(new Animated.Value(0)).current;
  const activeProgress = useRef(new Animated.Value(0)).current;
  const activeIconScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const progressAnimation = Animated.timing(activeProgress, {
      toValue: active ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    });
    const scaleAnimation = active
      ? Animated.sequence([
        Animated.timing(activeIconScale, { toValue: 1.05, duration: 110, useNativeDriver: true }),
        Animated.timing(activeIconScale, { toValue: 1, duration: 90, useNativeDriver: true }),
      ])
      : Animated.timing(activeIconScale, { toValue: 1, duration: 180, useNativeDriver: true });
    const animation = Animated.parallel([progressAnimation, scaleAnimation]);

    animation.start();
    return () => animation.stop();
  }, [active, activeIconScale, activeProgress]);

  const animatePress = (toValue: number) => {
    Animated.timing(pressProgress, {
      toValue,
      duration: toValue ? 90 : 110,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Pressable
      style={styles.bottomNavItem}
      onPress={() => {
        if (!active && Platform.OS !== 'web') {
          void Haptics.selectionAsync().catch(() => undefined);
        }
        onPress();
      }}
      onPressIn={() => animatePress(1)}
      onPressOut={() => animatePress(0)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
    >
      {({ pressed }) => (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.bottomNavIcon,
            {
              opacity: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
              transform: [{ scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }) }],
            },
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[
              styles.bottomNavRing,
              active && styles.bottomNavIconActive,
              pressed && !active && styles.bottomNavIconPressed,
              {
                backgroundColor: activeProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(8,8,8,0)', 'rgba(8,8,8,0.78)'],
                }),
                borderColor: activeProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['rgba(244,197,66,0)', colors.goldBorder],
                }),
                transform: [{ scale: activeProgress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) }],
              },
            ]}
          />
          <Animated.View style={[styles.bottomNavGlyphLayer, { opacity: pressed ? 0 : activeProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            <Ionicons name={icon} size={27} color={colors.textMuted} style={styles.bottomNavGlyph} />
          </Animated.View>
          <Animated.View
            style={[
              styles.bottomNavGlyphLayer,
              {
                opacity: pressed ? 1 : activeProgress,
                transform: [{ scale: activeIconScale }],
              },
            ]}
          >
            <Ionicons name={icon} size={27.5} color={colors.primary} style={styles.bottomNavGlyph} />
          </Animated.View>
          {badgeCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
            </View>
          ) : null}
        </Animated.View>
      )}
    </Pressable>
  );
}

export default function BottomNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const { unreadConversationCount } = useMessaging();
  const activeTab = activeTabByRoute[route.name];

  const openMessages = () => {
    if (route.name !== 'Messages') {
      navigation.navigate('Messages');
    }
  };

  if (!isFocused) return null;

  return (
    <View style={styles.bottomNav}>
      <View style={styles.bottomNavDivider} pointerEvents="none" />
      <BottomNavIcon active={activeTab === 'discover'} accessibilityLabel="Discover" icon="compass-outline" onPress={() => navigation.navigate('Home')} />
      <BottomNavIcon active={activeTab === 'host'} accessibilityLabel="Host" icon="add-circle-outline" onPress={() => navigation.navigate('CreateActivity')} />
      <BottomNavIcon active={activeTab === 'notifications'} accessibilityLabel="Notifications" icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} />
      <BottomNavIcon
        active={activeTab === 'messages'}
        accessibilityLabel={`Messages${unreadConversationCount ? `, ${unreadConversationCount} unread conversations` : ''}`}
        icon="chatbubbles-outline"
        onPress={openMessages}
        badgeCount={unreadConversationCount}
      />
      <BottomNavIcon active={activeTab === 'profile'} accessibilityLabel="Profile" icon="person-outline" onPress={() => navigation.navigate('Profile')} />
    </View>
  );
}

const styles = StyleSheet.create({
  bottomNav: {
    position: (Platform.OS === 'web' ? 'fixed' : 'absolute') as any,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    height: Platform.OS === 'web'
      ? (`calc(${BOTTOM_NAV_HEIGHT}px + env(safe-area-inset-bottom))` as any)
      : BOTTOM_NAV_HEIGHT,
    maxWidth: 520,
    alignSelf: 'center',
    marginHorizontal: 'auto' as any,
    paddingTop: 2,
    paddingBottom: Platform.OS === 'web'
      ? ('calc(2px + env(safe-area-inset-bottom))' as any)
      : 2,
    paddingHorizontal: 10,
    backgroundColor: Platform.OS === 'web' ? 'rgba(8,8,8,0.94)' : 'rgba(8,8,8,0.97)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: '#000000',
    shadowOpacity: 0.34,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -7 },
    elevation: 14,
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      backgroundImage: 'linear-gradient(180deg, rgba(20,18,12,0.96) 0%, rgba(8,8,8,0.94) 42%, rgba(5,5,5,0.96) 100%)',
      boxShadow: '0 -10px 24px rgba(0,0,0,0.42), inset 0 1px 0 rgba(246,196,69,0.08)',
    } as any) : {}),
  },
  bottomNavDivider: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(246,196,69,0.12)',
  },
  bottomNavItem: {
    flex: 1,
    minWidth: 44,
    minHeight: 44,
    marginHorizontal: 2,
    paddingHorizontal: 2,
    paddingVertical: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavIcon: {
    width: 42,
    height: 42,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavRing: {
    position: 'absolute',
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
  },
  bottomNavGlyph: {
    width: 28,
    height: 28,
    lineHeight: 28,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  bottomNavGlyphLayer: {
    position: 'absolute',
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavIconActive: {
    shadowColor: colors.primary,
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  bottomNavIconPressed: {
    borderColor: 'rgba(244,197,66,0.18)',
  },
  unreadBadge: {
    position: 'absolute',
    top: -2,
    right: -5,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: colors.background,
    zIndex: 3,
  },
  unreadBadgeText: {
    color: colors.primaryText,
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '900',
  },
});
