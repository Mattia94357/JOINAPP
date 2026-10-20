import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SoftTextInput } from './CinematicControls';
import InteractiveLocationMap from './InteractiveLocationMap';
import { getCurrentJoinLocationResult } from '../utils/locationService';
import { cachedPlaceSearch, Coordinate, CurrentRegion, insideRegion, locationFailureMessage, PASSPORT_MESSAGE, PlaceSuggestion } from '../utils/currentRegion';
import { registerCurrentRegionRequest, searchPlacesRequest } from '../api';
import { colors } from '../theme';

type Props = { token?: string | null; value: string; onChangeText: (value: string) => void;
  selected?: Coordinate; onSelect: (place: PlaceSuggestion) => void };
export default function ActivityLocationPicker({ token, value, onChangeText, selected, onSelect }: Props) {
  const [region, setRegion] = useState<CurrentRegion>();
  const [places, setPlaces] = useState<PlaceSuggestion[]>([]);
  const [message, setMessage] = useState('');
  const [locating, setLocating] = useState(false);
  const [searching, setSearching] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    setLocating(true);
    (async () => {
      const result = await getCurrentJoinLocationResult({ retryDenied: true, forceRefresh: true });
      if (result.status === 'failure') throw new Error(locationFailureMessage(result.reason));
      if (!token) throw new Error('Sign in to choose a location.');
      const response = await registerCurrentRegionRequest(result.coordinate, token);
      if (active) { setRegion(response.data); setMessage(''); }
    })().catch(error => { if (active) setMessage(error?.response?.data?.message || error.message); })
      .finally(() => { if (active) setLocating(false); });
    return () => { active = false; };
  }, [token, attempt]);
  useEffect(() => {
    const requestId = ++generation.current;
    setPlaces([]);
    setSearching(false);
    if (!region || !token || value.trim().length < 3 || selected) return;
    if (region.geocodingAvailable === false) {
      setMessage('Place search is not configured. Select a local meeting point on the map.');
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await cachedPlaceSearch(value, region, token, q => searchPlacesRequest(q, token).then(r => r.data));
        if (generation.current === requestId) { setPlaces(results); setMessage(results.length ? '' : 'No local places found. Try another name or select on the map.'); }
      } catch (error: any) {
        if (generation.current === requestId) setMessage(error?.response?.data?.message || error.message);
      } finally { if (generation.current === requestId) setSearching(false); }
    }, 450);
    return () => { clearTimeout(timer); generation.current++; };
  }, [value, region, token, selected]);
  const select = (place: PlaceSuggestion) => {
    if (region && Date.parse(region.expiresAt) <= Date.now()) { setMessage('Refresh your current device location before selecting a place.'); return; }
    if (!region || !insideRegion(region, place)) { setMessage(PASSPORT_MESSAGE); return; }
    setMessage(''); setPlaces([]); onSelect(place);
  };
  return <View>
    <SoftTextInput accessibilityLabel="Location" value={value} onChangeText={onChangeText} maxLength={120}
      placeholder="Search nearby places" placeholderTextColor={colors.textSubtle} style={{ color: colors.text, marginVertical: 12 }} />
    {locating || searching ? <ActivityIndicator color={colors.primary} /> : null}
    {places.map(place => <TouchableOpacity key={place.id} accessibilityRole="button" accessibilityLabel={`Select ${place.name}`}
      onPress={() => select(place)} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ color: colors.text, fontWeight: '700' }}>{place.name}</Text>
      <Text style={{ color: colors.textMuted, marginTop: 4 }}>{place.label}</Text>
    </TouchableOpacity>)}
    {message ? <Text accessibilityLiveRegion="polite" style={{ color: colors.textMuted, marginVertical: 8 }}>{message}</Text> : null}
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Retry current location" onPress={() => setAttempt(n => n + 1)}>
      <Text style={{ color: colors.primary, marginVertical: 10 }}>{region?.label || 'Use current location'} · Retry</Text>
    </TouchableOpacity>
    {region ? <View style={{ height: 260, borderRadius: 18, overflow: 'hidden', marginVertical: 12 }}>
      <InteractiveLocationMap coordinate={selected || region} approximate={!selected} showMarker={Boolean(selected)}
        onSelectCoordinate={point => select({ ...point, id: 'map-selection', name: value.trim() || 'Selected meeting point', label: value.trim() || region.label || 'Selected meeting point' })} />
    </View> : null}
    <Text style={{ color: colors.textMuted, fontSize: 12 }}>Choose a place or tap the map to set a local meeting point. Hosting elsewhere requires Passport Mode.</Text>
  </View>;
}
