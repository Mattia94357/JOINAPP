import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';
import { colors } from '../theme';

export type LocationPreviewActivity = {
  location: string;
  locationName?: string;
  exactAddress?: string;
  latitude?: number;
  longitude?: number;
  isApproximateLocation?: boolean;
  locationPrivacy?: 'public' | 'approximate' | 'private';
  visibility?: 'public' | 'private';
  joined?: boolean;
};

type Props = {
  visible: boolean;
  activity: LocationPreviewActivity;
  onClose: () => void;
};

export default function LocationPreviewModal({ visible, activity, onClose }: Props) {
  const safeAreaInsets = useContext(SafeAreaInsetsContext);
  const translateY = useRef(new Animated.Value(0)).current;
  const [mapsError, setMapsError] = useState(false);
  const locationName = activity.locationName || activity.location;
  const isApproximate = Boolean(
    activity.isApproximateLocation
      || activity.locationPrivacy === 'approximate'
      || activity.locationPrivacy === 'private'
      || (activity.visibility === 'private' && !activity.joined),
  );
  const hasCoordinates = !isApproximate
    && Number.isFinite(activity.latitude)
    && Number.isFinite(activity.longitude);

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      setMapsError(false);
    }
  }, [translateY, visible]);

  const dismiss = () => {
    Animated.timing(translateY, {
      toValue: 420,
      duration: 180,
      useNativeDriver: true,
    }).start(onClose);
  };

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 7 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 80 || gesture.vy > 0.9) {
        dismiss();
        return;
      }
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        speed: 24,
        bounciness: 4,
      }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
  }), [translateY]);

  const openExternalMaps = async () => {
    setMapsError(false);
    const coordinates = hasCoordinates ? `${activity.latitude},${activity.longitude}` : undefined;
    const query = coordinates || locationName;
    const encodedQuery = encodeURIComponent(query);
    const encodedLabel = encodeURIComponent(locationName);
    const browserUrl = `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
    const targetUrl = Platform.select({
      ios: coordinates
        ? `http://maps.apple.com/?ll=${coordinates}&q=${encodedLabel}`
        : `http://maps.apple.com/?q=${encodedLabel}`,
      android: coordinates
        ? `geo:${coordinates}?q=${coordinates}(${encodedLabel})`
        : `geo:0,0?q=${encodedLabel}`,
      default: browserUrl,
    }) || browserUrl;

    try {
      const supported = Platform.OS === 'web' || await Linking.canOpenURL(targetUrl);
      if (supported) {
        await Linking.openURL(targetUrl);
      } else {
        await Linking.openURL(browserUrl);
      }
    } catch {
      try {
        if (targetUrl !== browserUrl) await Linking.openURL(browserUrl);
        else throw new Error('Maps unavailable');
      } catch {
        setMapsError(true);
      }
    }
  };

  const nativeBottomPadding = Math.max(safeAreaInsets?.bottom || 0, 16);
  const webBottomPadding = 'calc(16px + env(safe-area-inset-bottom))' as any;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityRole="button"
          accessibilityLabel="Close map preview"
        />

        <Animated.View
          style={[
            styles.sheet,
            {
              paddingBottom: Platform.OS === 'web' ? webBottomPadding : nativeBottomPadding,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.dragArea} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>{isApproximate ? 'APPROXIMATE AREA' : 'ACTIVITY LOCATION'}</Text>
              <Text style={styles.title} numberOfLines={2}>{locationName}</Text>
              {!isApproximate && activity.exactAddress ? (
                <Text style={styles.address} numberOfLines={2}>{activity.exactAddress}</Text>
              ) : null}
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={dismiss}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Close map preview"
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.mapPreview} accessibilityLabel={`Map preview of ${locationName}`}>
            <View style={[styles.mapBlock, styles.mapBlockOne]} />
            <View style={[styles.mapBlock, styles.mapBlockTwo]} />
            <View style={[styles.mapBlock, styles.mapBlockThree]} />
            <View style={[styles.road, styles.roadOne]} />
            <View style={[styles.road, styles.roadTwo]} />
            <View style={[styles.road, styles.roadThree]} />
            <View style={styles.areaHalo} />
            <View style={styles.pinCircle}>
              <Ionicons name="location" size={28} color={colors.primary} />
            </View>
            <View style={styles.mapLabel}>
              <Text style={styles.mapLabelText} numberOfLines={1}>
                {isApproximate ? 'Approximate activity area' : locationName}
              </Text>
            </View>
          </View>

          {isApproximate ? (
            <View style={styles.privacyNotice}>
              <Ionicons name="lock-closed-outline" size={17} color={colors.primary} />
              <Text style={styles.privacyText}>Exact meeting point shared after joining.</Text>
            </View>
          ) : null}

          {mapsError ? <Text style={styles.errorText}>Unable to open maps right now.</Text> : null}

          <TouchableOpacity
            style={styles.mapsButton}
            onPress={openExternalMaps}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel="Open location in maps"
          >
            <Ionicons name="navigate-outline" size={19} color={colors.primaryText} />
            <Text style={styles.mapsButtonText}>Open in Maps</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.64)',
  },
  sheet: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 18,
    backgroundColor: '#11100E',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    borderColor: colors.goldBorder,
    shadowColor: '#000000',
    shadowOpacity: 0.46,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 24,
  },
  dragArea: {
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(246,196,69,0.3)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 15,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 12,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 5,
  },
  title: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
  },
  address: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  mapPreview: {
    height: 210,
    overflow: 'hidden',
    borderRadius: 18,
    backgroundColor: '#1B1B18',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.16)',
  },
  mapBlock: {
    position: 'absolute',
    borderRadius: 8,
    backgroundColor: '#282720',
  },
  mapBlockOne: { width: 118, height: 66, left: 18, top: 18, transform: [{ rotate: '-5deg' }] },
  mapBlockTwo: { width: 150, height: 72, right: 12, top: 28, transform: [{ rotate: '8deg' }] },
  mapBlockThree: { width: 190, height: 64, left: 54, bottom: 14, transform: [{ rotate: '-3deg' }] },
  road: {
    position: 'absolute',
    height: 9,
    borderRadius: 5,
    backgroundColor: '#39372E',
  },
  roadOne: { width: '120%', left: '-10%', top: 100, transform: [{ rotate: '-12deg' }] },
  roadTwo: { width: '90%', left: '8%', top: 62, transform: [{ rotate: '34deg' }] },
  roadThree: { width: '84%', left: '24%', top: 151, transform: [{ rotate: '-29deg' }] },
  areaHalo: {
    position: 'absolute',
    width: 78,
    height: 78,
    borderRadius: 39,
    left: '50%',
    top: '50%',
    marginLeft: -39,
    marginTop: -39,
    backgroundColor: 'rgba(246,196,69,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.18)',
  },
  pinCircle: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -27,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(10,10,9,0.92)',
    borderWidth: 1,
    borderColor: colors.goldBorder,
  },
  mapLabel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 11,
    alignSelf: 'flex-start',
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: 'rgba(8,8,8,0.83)',
  },
  mapLabelText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 13,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: colors.goldWash,
  },
  privacyText: {
    flex: 1,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginLeft: 8,
    fontWeight: '700',
  },
  errorText: {
    color: '#E8A9A9',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 10,
  },
  mapsButton: {
    minHeight: 50,
    marginTop: 15,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  mapsButtonText: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
});
