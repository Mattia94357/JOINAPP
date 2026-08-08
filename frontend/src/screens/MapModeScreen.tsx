import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Region } from 'react-native-maps';
import { RootStackParamList } from '../../App';
import MapModeMap from '../components/MapModeMap';
import type { MapActivity } from '../components/MapModeMap.types';
import { colors } from '../theme';
import { getActivityCoverImage } from '../utils/activityAssets';
import { getMapTilerConfig } from '../utils/mapConfig';

const categories = ['All', 'Food', 'Drinks', 'Sports', 'Adventure', 'Nightlife'];

type Props = NativeStackScreenProps<RootStackParamList, 'MapMode'>;

const PHUKET_REGION: Region = {
  latitude: 7.8804,
  longitude: 98.3923,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

const LOCATION_TIMEOUT_MS = 6000;

const withTimeout = <T,>(promise: Promise<T>, timeoutMs: number) => new Promise<T>((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('Location request timed out')), timeoutMs);
  promise.then(
    (value) => {
      clearTimeout(timeout);
      resolve(value);
    },
    (error) => {
      clearTimeout(timeout);
      reject(error);
    },
  );
});

const distanceBetween = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
) => {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const startLatitude = toRadians(from.latitude);
  const endLatitude = toRadians(to.latitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  const distanceKm = earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return distanceKm < 10 ? `${distanceKm.toFixed(1)} km away` : `${Math.round(distanceKm)} km away`;
};

export default function MapModeScreen({ navigation, route }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedActivity, setSelectedActivity] = useState(route.params.activity);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [userCoordinate, setUserCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showsUserLocation, setShowsUserLocation] = useState(false);
  const { height } = useWindowDimensions();
  const attendees = selectedActivity.attendees ?? selectedActivity.participants.length;
  const spotsLeft = selectedActivity.maxAttendees
    ? Math.max(selectedActivity.maxAttendees - attendees, 0)
    : null;
  const coverImage = selectedActivity.coverImage || getActivityCoverImage(selectedActivity.category, selectedActivity.id);
  const compactHeight = height < 760;
  const mapTilerConfig = useMemo(() => getMapTilerConfig(), []);

  const availableActivities = useMemo(() => {
    const activities = route.params.activities || [route.params.activity];
    return activities.some((activity) => activity.id === route.params.activity.id)
      ? activities
      : [route.params.activity, ...activities];
  }, [route.params.activities, route.params.activity]);

  const filteredActivities = useMemo(() => availableActivities.filter((activity) => (
    selectedCategory === 'All' || activity.category === selectedCategory
  )), [availableActivities, selectedCategory]);

  const mapActivities = useMemo<MapActivity[]>(() => filteredActivities
    .filter((activity) => (
      activity.locationPrivacy !== 'private'
      && Number.isFinite(activity.latitude)
      && Number.isFinite(activity.longitude)
    ))
    .slice(0, 30)
    .map((activity) => ({
      id: activity.id,
      title: activity.title,
      latitude: activity.latitude as number,
      longitude: activity.longitude as number,
      coverImage: activity.coverImage || getActivityCoverImage(activity.category, activity.id),
    })), [filteredActivities]);

  useEffect(() => {
    if (filteredActivities.some((activity) => activity.id === selectedActivity.id)) return;
    if (filteredActivities[0]) setSelectedActivity(filteredActivities[0]);
  }, [filteredActivities, selectedActivity.id]);

  const selectMapActivity = useCallback((activityId: string) => {
    const activity = availableActivities.find((candidate) => candidate.id === activityId);
    if (activity) setSelectedActivity(activity);
  }, [availableActivities]);

  const distanceText = useMemo(() => {
    if (
      userCoordinate
      && Number.isFinite(selectedActivity.latitude)
      && Number.isFinite(selectedActivity.longitude)
    ) {
      return distanceBetween(userCoordinate, {
        latitude: selectedActivity.latitude as number,
        longitude: selectedActivity.longitude as number,
      });
    }

    return 'Distance unavailable';
  }, [selectedActivity.latitude, selectedActivity.longitude, userCoordinate]);

  useEffect(() => {
    let active = true;

    const centerOnCurrentLocation = async () => {
      try {
        const existingPermission = await Location.getForegroundPermissionsAsync();
        const permission = existingPermission.granted || !existingPermission.canAskAgain
          ? existingPermission
          : await Location.requestForegroundPermissionsAsync();

        if (!permission.granted || !active) {
          if (active) setMapRegion(PHUKET_REGION);
          return;
        }

        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) throw new Error('Location services unavailable');

        const currentLocation = await withTimeout(
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
          LOCATION_TIMEOUT_MS,
        );

        if (!active) return;

        const coordinate = {
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        };
        setUserCoordinate(coordinate);
        setShowsUserLocation(true);
        setMapRegion({
          ...coordinate,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        });
      } catch {
        if (active) setMapRegion(PHUKET_REGION);
      }
    };

    centerOnCurrentLocation();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      {mapRegion ? (
        <MapModeMap
          initialRegion={mapRegion}
          showsUserLocation={showsUserLocation}
          activities={mapActivities}
          selectedActivityId={selectedActivity.id}
          onSelectActivity={selectMapActivity}
          mapTilerApiKey={mapTilerConfig.apiKey}
          mapStyleId={mapTilerConfig.styleId}
        />
      ) : (
        <View style={styles.mapLoading}>
          <ActivityIndicator color={colors.primary} size="small" />
        </View>
      )}

      <SafeAreaView style={styles.safeOverlay} pointerEvents="box-none">
        <View style={styles.topOverlay} pointerEvents="box-none">
          <View style={styles.topControls}>
          <TouchableOpacity
            style={styles.roundControl}
            onPress={navigation.goBack}
            activeOpacity={0.76}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={23} color={colors.primary} />
          </TouchableOpacity>

          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={19} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search activities or places"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel="Search activities or places"
              returnKeyType="search"
            />
          </View>

          <TouchableOpacity
            style={styles.roundControl}
            onPress={() => undefined}
            activeOpacity={0.76}
            accessibilityRole="button"
            accessibilityLabel="Filters"
          >
            <Ionicons name="options-outline" size={23} color={colors.primary} />
          </TouchableOpacity>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroller}
            contentContainerStyle={styles.categoryRow}
          >
            {categories.map((category) => {
              const selected = category === selectedCategory;
              return (
                <TouchableOpacity
                  key={category}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => setSelectedCategory(category)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`${category} category filter`}
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{category}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        <View
          style={[styles.previewCard, compactHeight && styles.previewCardCompact]}
        >
        <Image source={{ uri: coverImage }} style={[styles.previewImage, compactHeight && styles.previewImageCompact]} />

        <View
          style={styles.previewContent}
          accessible
          accessibilityLabel={`Activity preview: ${selectedActivity.title}`}
        >
          <Text style={styles.previewTitle} numberOfLines={1}>{selectedActivity.title}</Text>
          <Text style={styles.previewDistance}>{distanceText}</Text>
          <View style={styles.previewMetaRow}>
            <View style={styles.previewMetaItem}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={styles.previewMetaText} numberOfLines={1}>{selectedActivity.time || 'Anytime'}</Text>
            </View>
            <View style={styles.previewMetaItem}>
              <Ionicons name="people-outline" size={14} color={colors.primary} />
              <Text style={styles.previewMetaText} numberOfLines={1}>
                {spotsLeft === null ? 'Spots available' : `${spotsLeft} spots left`}
              </Text>
            </View>
          </View>
        </View>

        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => undefined}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={`Join ${selectedActivity.title}`}
        >
          <Text style={styles.joinButtonText}>JOIN</Text>
        </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    minHeight: 0,
    width: '100%',
    backgroundColor: '#111310',
    overflow: 'hidden',
    ...(Platform.OS === 'web' ? ({ height: '100dvh' } as any) : {}),
  },
  mapLoading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111310',
  },
  safeOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 10,
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'web'
      ? ('env(safe-area-inset-top)' as any)
      : 0,
    paddingBottom: Platform.OS === 'web'
      ? ('calc(28px + env(safe-area-inset-bottom))' as any)
      : 0,
  },
  topOverlay: {
    zIndex: 10,
    marginTop: 0,
  },
  topControls: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 8,
  },
  roundControl: {
    width: 46,
    height: 46,
    borderRadius: 23,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(10,10,10,0.92)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.32,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  searchBar: {
    flex: 1,
    minWidth: 0,
    height: 46,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.16)',
    backgroundColor: 'rgba(10,10,10,0.88)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 7,
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    height: 44,
    marginLeft: 8,
    paddingVertical: 0,
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
    outlineStyle: 'none' as any,
  },
  categoryScroller: {
    marginTop: 4,
  },
  categoryRow: {
    paddingHorizontal: 12,
    paddingBottom: 4,
    gap: 8,
  },
  categoryChip: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.16)',
    backgroundColor: 'rgba(12,12,12,0.86)',
  },
  categoryChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  categoryText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '900',
  },
  categoryTextSelected: {
    color: colors.primaryText,
  },
  previewCard: {
    zIndex: 10,
    height: 122,
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'web' ? 0 : 26,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(10,10,10,0.94)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
    ...(Platform.OS === 'web' ? ({
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
    } as any) : {}),
  },
  previewCardCompact: {
    height: 108,
    padding: 8,
    borderRadius: 22,
  },
  previewImage: {
    width: 94,
    height: 100,
    borderRadius: 14,
    flexShrink: 0,
    backgroundColor: colors.surfaceElevated,
  },
  previewImageCompact: {
    width: 78,
    height: 90,
    borderRadius: 12,
  },
  previewContent: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '900',
    marginBottom: 4,
  },
  previewDistance: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 9,
  },
  previewMetaRow: {
    gap: 5,
  },
  previewMetaItem: {
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  previewMetaText: {
    flexShrink: 1,
    marginLeft: 5,
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
  },
  joinButton: {
    minWidth: 48,
    height: 34,
    borderRadius: 17,
    paddingHorizontal: 9,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  joinButtonText: {
    color: colors.primaryText,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
});
