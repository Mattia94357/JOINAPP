import React, { useEffect, useState } from 'react';
import {
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
import { colors } from '../theme';
import { getActivityCoverImage } from '../utils/activityAssets';

const categories = ['All', 'Food', 'Drinks', 'Sports', 'Adventure', 'Nightlife'];

type Props = NativeStackScreenProps<RootStackParamList, 'MapMode'>;

const PHUKET_REGION: Region = {
  latitude: 7.8804,
  longitude: 98.3923,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

export default function MapModeScreen({ navigation, route }: Props) {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [mapRegion, setMapRegion] = useState<Region>(PHUKET_REGION);
  const [showsUserLocation, setShowsUserLocation] = useState(false);
  const { height } = useWindowDimensions();
  const { activity } = route.params;
  const attendees = activity.attendees ?? activity.participants.length;
  const spotsLeft = activity.maxAttendees
    ? Math.max(activity.maxAttendees - attendees, 0)
    : null;
  const coverImage = activity.coverImage || getActivityCoverImage(activity.category, activity.id);
  const compactHeight = height < 760;

  useEffect(() => {
    let active = true;

    const centerOnCurrentLocation = async () => {
      try {
        const existingPermission = await Location.getForegroundPermissionsAsync();
        const permission = existingPermission.granted || !existingPermission.canAskAgain
          ? existingPermission
          : await Location.requestForegroundPermissionsAsync();

        if (!permission.granted || !active) return;

        // Let the native map begin tracking immediately while the one-time fix resolves.
        setShowsUserLocation(true);

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        if (!active) return;

        setMapRegion({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
          latitudeDelta: 0.08,
          longitudeDelta: 0.08,
        });
      } catch {
        // Phuket remains visible if permission or location services are unavailable.
      }
    };

    centerOnCurrentLocation();

    return () => {
      active = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      <MapModeMap region={mapRegion} showsUserLocation={showsUserLocation} />

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
          accessibilityLabel={`Activity preview: ${activity.title}`}
        >
          <Text style={styles.previewTitle} numberOfLines={1}>{activity.title}</Text>
          <Text style={styles.previewDistance}>{activity.distance || '1.2 km'} away</Text>
          <View style={styles.previewMetaRow}>
            <View style={styles.previewMetaItem}>
              <Ionicons name="time-outline" size={14} color={colors.primary} />
              <Text style={styles.previewMetaText} numberOfLines={1}>{activity.time || 'Anytime'}</Text>
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
          accessibilityLabel={`Join ${activity.title}`}
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
