import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { Region } from 'react-native-maps';
import { RootStackParamList } from '../../App';
import MapModeMap from '../components/MapModeMap';
import type { MapActivity } from '../components/MapModeMap.types';
import AvatarBadge from '../components/AvatarBadge';
import { colors } from '../theme';
import { getActivityCoverImage } from '../utils/activityAssets';
import { curatedActivities } from '../utils/curatedActivities';
import { getMapTilerConfig } from '../utils/mapConfig';
import { activityCategories } from '../utils/categories';
import {
  getCurrentJoinLocationResult,
  isValidCoordinate,
  isValidMapRegion,
  readLastMapViewport,
  saveLastMapViewport,
} from '../utils/locationService';

const categories = ['All', ...activityCategories];

type Props = NativeStackScreenProps<RootStackParamList, 'MapMode'>;

// Legacy Phuket center retained only as the final no-context/no-location fallback.
const FINAL_FALLBACK_REGION: Region = {
  latitude: 7.8804,
  longitude: 98.3923,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

let sessionMapViewport: Region | null = null;

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
  const initialActivities = route.params?.activities?.length
    ? route.params.activities
    : curatedActivities;
  const initialActivity = route.params?.activity || initialActivities[0];
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(initialActivity);
  const [selectedClusterCount, setSelectedClusterCount] = useState<number | null>(null);
  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const [userCoordinate, setUserCoordinate] = useState<{ latitude: number; longitude: number } | null>(null);
  const [recenterRequest, setRecenterRequest] = useState<{ latitude: number; longitude: number; requestId: number } | null>(null);
  const [locationState, setLocationState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const persistViewportTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackViewportActive = useRef(false);
  const { height } = useWindowDimensions();
  const attendees = selectedActivity.attendees ?? selectedActivity.participants.length;
  const spotsLeft = selectedActivity.maxAttendees
    ? Math.max(selectedActivity.maxAttendees - attendees, 0)
    : null;
  const coverImage = selectedActivity.coverImage || getActivityCoverImage(selectedActivity.category, selectedActivity.id);
  const creatorName = selectedActivity.host?.trim() || 'JOIN member';
  const creatorDisplayName = creatorName.split(/\s+/)[0];
  const compactHeight = height < 760;
  const mapTilerConfig = useMemo(() => getMapTilerConfig(), []);

  const availableActivities = useMemo(() => {
    const requestedActivity = route.params?.activity;
    const activities = route.params?.activities?.length
      ? route.params.activities
      : curatedActivities;
    if (!requestedActivity) return activities;
    return activities.some((activity) => activity.id === requestedActivity.id)
      ? activities
      : [requestedActivity, ...activities];
  }, [route.params?.activities, route.params?.activity]);

  const filteredActivities = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    return availableActivities.filter((activity) => (
      (selectedCategory === 'All' || activity.category === selectedCategory)
      && (!query || [activity.title, activity.category, activity.location]
        .some((value) => value?.toLocaleLowerCase().includes(query)))
    ));
  }, [availableActivities, searchQuery, selectedCategory]);

  useEffect(() => {
    setSelectedClusterCount(null);
  }, [searchQuery, selectedCategory]);

  const mapActivities = useMemo<MapActivity[]>(() => filteredActivities
    .filter((activity) => (
      activity.locationPrivacy !== 'private'
      && Number.isFinite(activity.latitude)
      && Number.isFinite(activity.longitude)
    ))
    .map((activity) => ({
      id: activity.id,
      title: activity.title,
      category: activity.category,
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
    if (activity) {
      setSelectedClusterCount(null);
      setSelectedActivity(activity);
    }
  }, [availableActivities]);

  useEffect(() => {
    const result = route.params?.decisionResult;
    if (!result) return;

    if (result.decision === 'join') {
      setSelectedActivity((activity) => activity.id === result.activityId
        ? {
          ...activity,
          joined: result.joinStatus === 'joined',
          pending: result.joinStatus === 'pending',
          declined: result.joinStatus === 'declined',
          waitlisted: result.joinStatus === 'waitlisted',
        }
        : activity);
      return;
    }

    setSelectedActivity((activity) => {
      if (activity.id !== result.activityId) return activity;
      return filteredActivities.find((candidate) => candidate.id !== result.activityId) || activity;
    });
  }, [filteredActivities, route.params?.decisionResult]);

  const openDecisionCard = useCallback(() => {
    navigation.push('Home', {
      source: 'map',
      mapDecisionActivity: selectedActivity,
      mapReturnRouteKey: route.key,
    });
  }, [navigation, route.key, selectedActivity]);

  const openCreatorProfile = useCallback(() => {
    navigation.navigate('PublicProfile', {
      userId: selectedActivity.hostId || undefined,
      fallbackName: creatorName,
      fallbackAvatar: selectedActivity.hostAvatar,
    });
  }, [creatorName, navigation, selectedActivity.hostAvatar, selectedActivity.hostId]);

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

  const rememberMapViewport = useCallback((region: Region) => {
    if (!isValidMapRegion(region)) return;
    const isUntouchedPhuketFallback = fallbackViewportActive.current
      && Math.abs(region.latitude - FINAL_FALLBACK_REGION.latitude) < 0.0001
      && Math.abs(region.longitude - FINAL_FALLBACK_REGION.longitude) < 0.0001;
    if (isUntouchedPhuketFallback) return;
    fallbackViewportActive.current = false;
    sessionMapViewport = region;
    if (persistViewportTimer.current) clearTimeout(persistViewportTimer.current);
    persistViewportTimer.current = setTimeout(() => void saveLastMapViewport(region), 500);
  }, []);

  const applyCurrentCoordinate = useCallback((coordinate: { latitude: number; longitude: number }) => {
    if (!isValidCoordinate(coordinate)) {
      setLocationState('unavailable');
      return;
    }

    setUserCoordinate(coordinate);
    setLocationState('ready');
    fallbackViewportActive.current = false;
    const region = { ...coordinate, latitudeDelta: 0.06, longitudeDelta: 0.06 };
    sessionMapViewport = region;
    void saveLastMapViewport(region);
    setRecenterRequest({ ...coordinate, requestId: Date.now() });
  }, []);

  const recenterOnCurrentLocation = useCallback(() => {
    setLocationState('loading');

    if (Platform.OS === 'web') {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        setLocationState('unavailable');
        return;
      }

      // Keep this direct call synchronous with the user tap so Safari can show its native prompt.
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coordinate = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          applyCurrentCoordinate(coordinate);
        },
        (error) => {
          console.warn('JOIN geolocation error', { code: error.code, message: error.message });
          setLocationState('unavailable');
        },
        { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
      );
      return;
    }

    void getCurrentJoinLocationResult({
      forceRefresh: true,
      retryDenied: true,
    }).then((result) => {
      if (result.status === 'success') {
        applyCurrentCoordinate(result.coordinate);
        return;
      }
      setLocationState('unavailable');
    });
  }, [applyCurrentCoordinate]);

  useEffect(() => {
    let active = true;

    const initializeMap = async () => {
      const previousSessionViewport = isValidMapRegion(sessionMapViewport) ? sessionMapViewport : null;
      const storedViewportPromise = readLastMapViewport();
      const locationResult = await getCurrentJoinLocationResult({
        forceRefresh: true,
        retryDenied: true,
      });
      if (!active) return;
      if (locationResult.status === 'success') {
        const { coordinate } = locationResult;
        const region = { ...coordinate, latitudeDelta: 0.06, longitudeDelta: 0.06 };
        setUserCoordinate(coordinate);
        setLocationState('ready');
        setMapRegion(region);
        sessionMapViewport = region;
        void saveLastMapViewport(region);
        return;
      }

      setLocationState('unavailable');
      if (previousSessionViewport) {
        setMapRegion(previousSessionViewport);
        return;
      }

      const storedViewport = await storedViewportPromise;
      if (!active) return;
      if (isValidMapRegion(storedViewport)) {
        setMapRegion(storedViewport);
        sessionMapViewport = storedViewport;
        return;
      }

      fallbackViewportActive.current = true;
      setMapRegion(FINAL_FALLBACK_REGION);
    };

    initializeMap();

    return () => {
      active = false;
      if (persistViewportTimer.current) clearTimeout(persistViewportTimer.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      {mapRegion ? (
        <MapModeMap
          initialRegion={mapRegion}
          showsUserLocation={Boolean(userCoordinate)}
          userCoordinate={userCoordinate}
          recenterRequest={recenterRequest}
          activities={mapActivities}
          selectedActivityId={selectedActivity.id}
          onSelectActivity={selectMapActivity}
          onSelectCluster={setSelectedClusterCount}
          onViewportChange={rememberMapViewport}
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
              value={searchQuery}
              onChangeText={setSearchQuery}
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

        <View style={styles.locationControlArea} pointerEvents="box-none">
          {locationState === 'unavailable' ? (
            <View style={styles.locationUnavailableBadge} pointerEvents="none">
              <Text style={styles.locationUnavailableText}>Location unavailable</Text>
            </View>
          ) : null}
          <TouchableOpacity
            style={styles.currentLocationControl}
            onPress={recenterOnCurrentLocation}
            disabled={locationState === 'loading'}
            activeOpacity={0.76}
            accessibilityRole="button"
            accessibilityLabel="Recenter map on current location"
          >
            {locationState === 'loading' ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Ionicons name="locate-outline" size={22} color={colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {selectedClusterCount ? (
          <View
            style={[styles.clusterSummary, compactHeight && styles.clusterSummaryCompact]}
            accessibilityRole="summary"
            accessibilityLabel={`${selectedClusterCount} activities in this area. Zoom in to explore.`}
          >
            <View style={styles.clusterSummaryCount}>
              <Text style={styles.clusterSummaryCountText}>{selectedClusterCount}</Text>
            </View>
            <View style={styles.clusterSummaryCopy}>
              <Text style={styles.clusterSummaryTitle}>{selectedClusterCount} activities here</Text>
              <Text style={styles.clusterSummaryHint}>Zoom in to explore</Text>
            </View>
            <Ionicons name="chevron-up" size={18} color={colors.primary} />
          </View>
        ) : <TouchableOpacity
          style={[styles.previewCard, compactHeight && styles.previewCardCompact]}
          onPress={openDecisionCard}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Open ${selectedActivity.title} decision card`}
        >
        <Image source={{ uri: coverImage }} style={[styles.previewImage, compactHeight && styles.previewImageCompact]} />

        <View
          style={styles.previewContent}
          accessibilityLabel={`Activity preview: ${selectedActivity.title}`}
        >
          <Text style={styles.previewTitle} numberOfLines={1}>{selectedActivity.title}</Text>
          <Text style={styles.previewDistance}>{distanceText}</Text>
          <View style={styles.previewMetaRow}>
            <View style={styles.previewMetaList}>
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
            <TouchableOpacity
              style={styles.creatorButton}
              onPress={(event) => {
                event.stopPropagation();
                openCreatorProfile();
              }}
              activeOpacity={0.72}
              accessibilityRole="button"
              accessibilityLabel={`Open ${creatorName}'s profile`}
            >
              <AvatarBadge name={creatorName} avatarUrl={selectedActivity.hostAvatar} size={26} />
              <Text style={styles.creatorName} numberOfLines={1}>{creatorDisplayName}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View
          style={styles.joinButton}
          pointerEvents="none"
        >
          <Text style={styles.joinButtonText}>JOIN</Text>
        </View>
        </TouchableOpacity>}
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
  locationControlArea: {
    position: 'absolute',
    top: 98,
    right: 12,
    zIndex: 12,
    alignItems: 'flex-end',
    gap: 7,
  },
  currentLocationControl: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(10,10,10,0.92)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 8,
  },
  locationUnavailableBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(246,196,69,0.2)',
    backgroundColor: 'rgba(10,10,10,0.86)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  locationUnavailableText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '800',
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
  clusterSummary: {
    zIndex: 10,
    minHeight: 82,
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'web' ? 0 : 26,
    borderRadius: 22,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: colors.goldBorder,
    backgroundColor: 'rgba(10,10,10,0.94)',
    shadowColor: colors.shadow,
    shadowOpacity: 0.42,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  clusterSummaryCompact: {
    minHeight: 72,
  },
  clusterSummaryCount: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#171713',
  },
  clusterSummaryCountText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '900',
  },
  clusterSummaryCopy: {
    flex: 1,
    paddingHorizontal: 12,
  },
  clusterSummaryTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
  },
  clusterSummaryHint: {
    marginTop: 3,
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
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
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  previewMetaList: {
    flex: 1,
    minWidth: 0,
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
  creatorButton: {
    maxWidth: 88,
    minWidth: 0,
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 3,
  },
  creatorName: {
    minWidth: 0,
    flexShrink: 1,
    color: colors.text,
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
