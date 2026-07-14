import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
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
import InteractiveLocationMap from './InteractiveLocationMap';

type MapCoordinate = { latitude: number; longitude: number };

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
  const [mapCoordinate, setMapCoordinate] = useState<MapCoordinate | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
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

  const protectCoordinate = (coordinate: MapCoordinate): MapCoordinate => (
    isApproximate
      ? {
          latitude: Math.round(coordinate.latitude * 100) / 100,
          longitude: Math.round(coordinate.longitude * 100) / 100,
        }
      : coordinate
  );

  useEffect(() => {
    if (visible) {
      translateY.setValue(0);
      setMapsError(false);
    }
  }, [translateY, visible]);

  useEffect(() => {
    if (!visible) return undefined;

    if (Number.isFinite(activity.latitude) && Number.isFinite(activity.longitude)) {
      setMapCoordinate(protectCoordinate({
        latitude: activity.latitude as number,
        longitude: activity.longitude as number,
      }));
      setMapLoading(false);
      return undefined;
    }

    const controller = new AbortController();
    setMapCoordinate(null);
    setMapLoading(true);
    fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(locationName)}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    })
      .then((response) => response.ok ? response.json() : [])
      .then((results) => {
        const first = results?.[0];
        const latitude = Number(first?.lat);
        const longitude = Number(first?.lon);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setMapCoordinate(protectCoordinate({ latitude, longitude }));
        }
      })
      .catch(() => undefined)
      .finally(() => setMapLoading(false));

    return () => controller.abort();
  }, [activity.latitude, activity.longitude, isApproximate, locationName, visible]);

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
    const coordinates = hasCoordinates
      ? `${activity.latitude},${activity.longitude}`
      : isApproximate && mapCoordinate
        ? `${mapCoordinate.latitude},${mapCoordinate.longitude}`
        : undefined;
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
              <View style={styles.closeButtonVisual}>
                <Ionicons name="close" size={20} color={colors.text} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.mapPreview} accessibilityLabel={`Interactive map of ${locationName}`}>
            {mapCoordinate ? (
              <InteractiveLocationMap coordinate={mapCoordinate} approximate={isApproximate} />
            ) : (
              <View style={styles.mapFallback}>
                {mapLoading ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="map-outline" size={30} color={colors.primary} />}
                <Text style={styles.mapFallbackText}>{mapLoading ? 'Finding activity area…' : 'Map preview unavailable'}</Text>
              </View>
            )}
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
    height: 25,
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
    marginBottom: 10,
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
  },
  closeButtonVisual: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20,18,15,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.28)',
  },
  mapPreview: {
    height: 252,
    overflow: 'hidden',
    borderRadius: 21,
    backgroundColor: '#1B1B18',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.16)',
  },
  mapFallback: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1B1B18',
  },
  mapFallbackText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
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
    marginTop: 10,
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
