import React, { useRef } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RouteProp, useIsFocused, useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
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
};

const activeTabByRoute: Partial<Record<keyof RootStackParamList, BottomNavTab>> = {
  Home: 'discover',
  CreateActivity: 'host',
  Notifications: 'notifications',
  Chat: 'messages',
  Profile: 'profile',
};

function BottomNavIcon({ active, accessibilityLabel, icon, onPress }: BottomNavIconProps) {
  const pressProgress = useRef(new Animated.Value(0)).current;

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
      onPress={onPress}
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
            (active || pressed) && styles.bottomNavIconActive,
            {
              opacity: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
              transform: [{ scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.95] }) }],
            },
          ]}
        >
          <Ionicons
            name={icon}
            size={25}
            color={active || pressed ? colors.primary : colors.textMuted}
            style={styles.bottomNavGlyph}
          />
        </Animated.View>
      )}
    </Pressable>
  );
}

export default function BottomNavigation() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const activeTab = activeTabByRoute[route.name];

  const openMessages = () => {
    if (route.name !== 'Chat') {
      navigation.navigate('Chat', { chatId: 'general', title: 'Messages' });
    }
  };

  if (!isFocused) return null;

  return (
    <View style={styles.bottomNav}>
      <View style={styles.bottomNavDivider} pointerEvents="none" />
      <BottomNavIcon active={activeTab === 'discover'} accessibilityLabel="Discover" icon="compass-outline" onPress={() => navigation.navigate('Home')} />
      <BottomNavIcon active={activeTab === 'host'} accessibilityLabel="Host" icon="add-circle-outline" onPress={() => navigation.navigate('CreateActivity')} />
      <BottomNavIcon active={activeTab === 'notifications'} accessibilityLabel="Notifications" icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} />
      <BottomNavIcon active={activeTab === 'messages'} accessibilityLabel="Messages" icon="chatbubbles-outline" onPress={openMessages} />
      <BottomNavIcon active={activeTab === 'profile'} accessibilityLabel="Profile" icon="person-circle-outline" onPress={() => navigation.navigate('Profile')} />
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
    backgroundColor: '#080808',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    shadowColor: colors.primary,
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 16,
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      boxShadow: '0 -8px 24px rgba(0,0,0,0.48), 0 0 14px rgba(245,190,60,0.12)',
    } as any) : {}),
  },
  bottomNavDivider: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    backgroundColor: 'rgba(246,196,69,0.16)',
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
    borderRadius: 21,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavGlyph: {
    width: 26,
    height: 26,
    lineHeight: 26,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  bottomNavIconActive: {
    backgroundColor: 'rgba(8,8,8,0.76)',
    borderColor: colors.goldBorder,
    shadowColor: colors.primary,
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
});
