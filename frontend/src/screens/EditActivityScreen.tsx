import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { ActivityEditPayload, ActivityResponse, fetchActivity, updateActivityRequest } from '../api';
import { useAuth } from '../context/AuthContext';
import { colors, spacing } from '../theme';
import { activityCategories } from '../utils/categories';
import { ActivityAgeGroup, ageGroupOptions, combineLocalDateAndTime } from '../utils/activityFilters';
import { geocodeActivityLocation } from '../utils/mapConfig';

type Props = NativeStackScreenProps<RootStackParamList, 'EditActivity'>;
const imageUrlPattern = /^https?:\/\/.+\.(jpg|jpeg|png|webp)(\?.*)?$/i;
const pad = (value: number) => String(value).padStart(2, '0');
const localDate = (value?: string) => {
  const parsed = value ? new Date(value) : undefined;
  return parsed && !Number.isNaN(parsed.getTime())
    ? `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`
    : '';
};
const localTime = (value?: string) => {
  const parsed = value ? new Date(value) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? `${pad(parsed.getHours())}:${pad(parsed.getMinutes())}` : '';
};

export default function EditActivityScreen({ route, navigation }: Props) {
  const { activityId } = route.params;
  const { token, user } = useAuth();
  const baseline = useRef<ActivityResponse>();
  const savingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Other');
  const [location, setLocation] = useState('');
  const [locationName, setLocationName] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('');
  const [ageGroup, setAgeGroup] = useState<ActivityAgeGroup>('any');
  const [vibe, setVibe] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [galleryImagesText, setGalleryImagesText] = useState('');
  const [locationPrivacy, setLocationPrivacy] = useState<'public' | 'approximate' | 'private'>('public');

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!token) { setError('Log in to edit this activity.'); setLoading(false); return; }
      try {
        const activity = await fetchActivity(activityId, token);
        if (!mounted) return;
        if (activity.hostId !== user?.id) throw new Error('Only the host can edit this activity.');
        baseline.current = activity;
        setTitle(activity.title);
        setCategory(activity.category);
        setLocation(activity.location);
        setLocationName(activity.locationName || '');
        setDescription(activity.description);
        setDate(localDate(activity.startsAt));
        setTime(localTime(activity.startsAt));
        setMaxAttendees(String(activity.maxAttendees || Math.max(activity.participants.length, 2)));
        setAgeGroup(activity.ageGroup || 'any');
        setVibe(activity.vibe || '');
        setCoverImage(activity.coverImage || '');
        setGalleryImagesText((activity.galleryImages || []).join('\n'));
        setLocationPrivacy(activity.locationPrivacy || 'public');
      } catch (requestError: any) {
        if (mounted) setError(requestError?.response?.data?.message || requestError?.message || 'Could not load this activity.');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [activityId, token, user?.id]);

  const showError = (message: string) => {
    setError(message);
    if (Platform.OS !== 'web') Alert.alert('Check details', message);
  };

  const save = async () => {
    if (savingRef.current || !baseline.current) return;
    const original = baseline.current;
    const capacity = Number(maxAttendees);
    const startsAt = combineLocalDateAndTime(date, time);
    const galleryImages = galleryImagesText.split('\n').map((item) => item.trim()).filter(Boolean);
    if (title.trim().length < 3) return showError('Activity title must be at least 3 characters.');
    if (location.trim().length < 2) return showError('Location is required.');
    if (description.trim().length < 20) return showError('Description must be at least 20 characters.');
    if (!startsAt || startsAt.getTime() <= Date.now()) return showError('Choose a valid future date and start time.');
    if (!Number.isInteger(capacity) || capacity < 2) return showError('Max participants must be an integer of at least 2.');
    if (capacity < original.participants.length) return showError(`Max participants cannot be below the ${original.participants.length} current participants.`);
    if (coverImage.trim() && !imageUrlPattern.test(coverImage.trim())) return showError('Use a valid JPEG, PNG, or WEBP cover image URL.');
    if (galleryImages.length > 5 || galleryImages.some((image) => !imageUrlPattern.test(image))) return showError('Use up to 5 valid JPEG, PNG, or WEBP gallery image URLs.');
    if (!token) return showError('Log in to save changes.');

    savingRef.current = true;
    setSaving(true);
    setError('');

    const payload: ActivityEditPayload = {};
    const changed = <K extends keyof ActivityEditPayload>(key: K, next: ActivityEditPayload[K], previous: unknown) => {
      if (JSON.stringify(next) !== JSON.stringify(previous)) payload[key] = next as never;
    };
    changed('title', title.trim(), original.title);
    changed('category', category, original.category);
    changed('location', location.trim(), original.location);
    changed('locationName', locationName.trim(), original.locationName || '');
    changed('description', description.trim(), original.description);
    changed('date', startsAt.toISOString(), original.startsAt);
    changed('maxAttendees', capacity, original.maxAttendees);
    changed('ageGroup', ageGroup, original.ageGroup || 'any');
    changed('vibe', vibe.trim(), original.vibe || '');
    changed('coverImage', coverImage.trim(), original.coverImage || '');
    changed('galleryImages', galleryImages, original.galleryImages || []);
    changed('locationPrivacy', locationPrivacy, original.locationPrivacy || 'public');
    changed('isApproximateLocation', locationPrivacy === 'approximate', Boolean(original.isApproximateLocation));

    if (location.trim() !== original.location || locationName.trim() !== (original.locationName || '')) {
      try {
        const coordinate = await geocodeActivityLocation([locationName.trim(), location.trim()].filter(Boolean).join(', '));
        payload.latitude = coordinate.latitude;
        payload.longitude = coordinate.longitude;
      } catch (geocodeError: any) {
        savingRef.current = false;
        setSaving(false);
        return showError(geocodeError?.message || 'Could not find that activity location.');
      }
    }
    if (!Object.keys(payload).length) {
      savingRef.current = false;
      setSaving(false);
      return showError('No changes to save.');
    }
    try {
      await updateActivityRequest(activityId, payload, token);
      if (Platform.OS !== 'web') Alert.alert('Activity updated', 'Your changes are live.');
      navigation.replace('Activity', { activityId });
    } catch (requestError: any) {
      showError(requestError?.response?.data?.message || 'Could not update this activity.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  if (!baseline.current) return <View style={styles.center}><Text style={styles.error}>{error}</Text></View>;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.intro}>Update the essentials for your upcoming activity. Membership and privacy access stay unchanged.</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.label}>Activity title</Text>
      <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholderTextColor={colors.textSubtle} />
      <Text style={styles.label}>Category</Text>
      <View style={styles.chips}>{activityCategories.map((option) => <TouchableOpacity key={option} style={[styles.chip, category === option && styles.chipActive]} onPress={() => setCategory(option)}><Text style={[styles.chipText, category === option && styles.chipTextActive]}>{option}</Text></TouchableOpacity>)}</View>
      <Text style={styles.label}>Area or suburb</Text>
      <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholderTextColor={colors.textSubtle} />
      <Text style={styles.label}>Location name</Text>
      <TextInput style={styles.input} value={locationName} onChangeText={setLocationName} placeholder="Optional meeting place" placeholderTextColor={colors.textSubtle} />
      <View style={styles.columns}><View style={styles.column}><Text style={styles.label}>Date</Text><TextInput style={styles.input} value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor={colors.textSubtle} /></View><View style={styles.column}><Text style={styles.label}>Start time</Text><TextInput style={styles.input} value={time} onChangeText={setTime} placeholder="19:30" placeholderTextColor={colors.textSubtle} /></View></View>
      <Text style={styles.label}>Max participants</Text>
      <TextInput style={styles.input} value={maxAttendees} onChangeText={setMaxAttendees} keyboardType="number-pad" placeholderTextColor={colors.textSubtle} />
      <Text style={styles.hint}>Current confirmed participants: {baseline.current.participants.length}</Text>
      <Text style={styles.label}>Description</Text>
      <TextInput style={[styles.input, styles.textArea]} value={description} onChangeText={setDescription} multiline placeholderTextColor={colors.textSubtle} />
      <Text style={styles.label}>Location detail</Text>
      <View style={styles.chips}>{(['public', 'approximate', 'private'] as const).map((option) => <TouchableOpacity key={option} style={[styles.chip, locationPrivacy === option && styles.chipActive]} onPress={() => setLocationPrivacy(option)}><Text style={[styles.chipText, locationPrivacy === option && styles.chipTextActive]}>{option[0].toUpperCase() + option.slice(1)}</Text></TouchableOpacity>)}</View>
      <Text style={styles.label}>Intended age group</Text>
      <View style={styles.chips}>{ageGroupOptions.map((option) => <TouchableOpacity key={option.value} style={[styles.chip, ageGroup === option.value && styles.chipActive]} onPress={() => setAgeGroup(option.value)}><Text style={[styles.chipText, ageGroup === option.value && styles.chipTextActive]}>{option.label}</Text></TouchableOpacity>)}</View>
      <Text style={styles.label}>Vibe</Text>
      <TextInput style={styles.input} value={vibe} onChangeText={setVibe} placeholder="Optional" placeholderTextColor={colors.textSubtle} />
      <Text style={styles.label}>Cover image URL</Text>
      <TextInput style={styles.input} value={coverImage} onChangeText={setCoverImage} autoCapitalize="none" placeholder="Optional" placeholderTextColor={colors.textSubtle} />
      <Text style={styles.label}>Gallery image URLs</Text>
      <TextInput style={[styles.input, styles.gallery]} value={galleryImagesText} onChangeText={setGalleryImagesText} autoCapitalize="none" multiline placeholder="One URL per line, up to 5" placeholderTextColor={colors.textSubtle} />
      <TouchableOpacity style={[styles.save, saving && styles.disabled]} disabled={saving} onPress={save}>{saving ? <ActivityIndicator color={colors.primaryText} /> : <Text style={styles.saveText}>Save changes</Text>}</TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  container: { padding: spacing.md, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: spacing.lg },
  intro: { color: colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: spacing.md },
  error: { color: colors.danger, fontSize: 14, lineHeight: 20, marginBottom: spacing.md, textAlign: 'center' },
  label: { color: colors.text, fontSize: 14, fontWeight: '700', marginTop: spacing.md, marginBottom: spacing.sm },
  hint: { color: colors.textSubtle, fontSize: 12, marginTop: 6 },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.text, paddingHorizontal: 14, fontSize: 15 },
  textArea: { minHeight: 120, paddingTop: 13, textAlignVertical: 'top' },
  gallery: { minHeight: 92, paddingTop: 13, textAlignVertical: 'top' },
  columns: { flexDirection: 'row', gap: 12 },
  column: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.goldWash },
  chipText: { color: colors.textMuted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.primary },
  save: { minHeight: 52, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: spacing.xxl },
  saveText: { color: colors.primaryText, fontSize: 16, fontWeight: '900' },
  disabled: { opacity: 0.6 },
});
