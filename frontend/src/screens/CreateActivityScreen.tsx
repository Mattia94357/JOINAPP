import React, { useEffect, useRef, useState } from 'react';
import * as Crypto from 'expo-crypto';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform, useWindowDimensions, Image, Animated, KeyboardAvoidingView, Modal, BackHandler } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NavigationAction } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { createActivityRequest } from '../api';
import { colors } from '../theme';
import { reportFrontendError } from '../utils/safeError';
import { activityCategories } from '../utils/categories';
import { geocodeActivityLocation } from '../utils/mapConfig';
import { ActivityAgeGroup, ageGroupOptions, combineLocalDateAndTime } from '../utils/activityFilters';
import { ActivityDateSelector, ActivityTimeSelector, activityTimeOptions, formatActivityDate } from '../components/ActivityDateTimeSelectors';
import { chooseActivityPhotoSource, pickActivityImage, PhotoSource } from '../utils/mediaPermissions';
import { resolveActivityImage } from '../utils/activityAssets';
import { ChoiceCard, SoftTextInput } from '../components/CinematicControls';
import ParticipantStepper from '../components/ParticipantStepper';
import ActivityOptionalDetails from '../components/ActivityOptionalDetails';

const categoryOptions = activityCategories;

const wizardSteps = [
  { label: 'Title', title: 'What’s the activity called?', hint: 'Give your plan a name people will remember.' },
  { label: 'Category', title: 'Choose a category', hint: 'Find the right home for your idea.' },
  { label: 'Location', title: 'Where is it happening?', hint: 'A place nearby. A reason to get together.' },
  { label: 'Date & time', title: 'When is it happening?', hint: 'Choose your date and time. End time is optional.' },
  { label: 'Participation', title: 'Who can join?', hint: 'Set the size of your group and how people join.' },
  { label: 'Description', title: 'Tell people about it', hint: 'Help people picture themselves there.' },
  { label: 'Cover image', title: 'Add a cover image', hint: 'Choose a picture, or keep your category’s default.' },
  { label: 'Review', title: 'Review your plan', hint: 'One last look before you bring people together.' },
];

type Props = NativeStackScreenProps<RootStackParamList, 'CreateActivity'>;

export default function CreateActivityScreen({ navigation }: Props) {
  const { token } = useAuth();
  const { width } = useWindowDimensions();
  const compact = width < 420;
  const [title, setTitle] = useState('');
  const [venueName, setVenueName] = useState('');
  const [location, setLocation] = useState('');
  const [exactAddress, setExactAddress] = useState('');
  const [category, setCategory] = useState('Wellness');
  const [vibe, setVibe] = useState('Laid-back');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxAttendees, setMaxAttendees] = useState('8');
  const [costType, setCostType] = useState<'Free' | 'Paid'>('Free');
  const [costAmount, setCostAmount] = useState('');
  const [coverImage, setCoverImage] = useState<{ uri: string; data: string }>();
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [ageGroup, setAgeGroup] = useState<ActivityAgeGroup>('any');
  const [hostNote, setHostNote] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [moreDetailsOpen, setMoreDetailsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [confirmExit, setConfirmExit] = useState(false);
  const [imagePicking, setImagePicking] = useState(false);
  const transition = useRef(new Animated.Value(1)).current;
  const scroll = useRef<ScrollView>(null);
  const allowExit = useRef(false);
  const publishing = useRef(false);
  const pendingExit = useRef<NavigationAction>();
  const clientRequest = useRef<{ fingerprint: string; id: string }>();

  const showError = (message: string) => {
    setErrorMessage(message);
    if (Platform.OS !== 'web') Alert.alert('Check details', message);
  };

  const selectActivityImage = async (source: PhotoSource) => {
    if (imagePicking) return;
    setImagePicking(true);
    setErrorMessage('');
    try {
      const asset = await pickActivityImage(source);
      if (!asset?.base64) return;
      const bytes = Math.ceil((asset.base64.length * 3) / 4);
      if (bytes > 4 * 1024 * 1024) return showError('Activity pictures must be 4 MB or smaller.');
      setCoverImage({ uri: asset.uri, data: `data:image/jpeg;base64,${asset.base64}` });
    } catch (error) {
      reportFrontendError('activity_image_prepare_failed', error);
      showError('Could not prepare that picture. Please choose another image.');
    } finally { setImagePicking(false); }
  };

  const validateStep = (index: number): string | undefined => {
    if (index === 0 && !title.trim()) return 'Activity title is required.';
    if (index === 1 && !categoryOptions.includes(category)) return 'Choose a category.';
    if (index === 2 && !location.trim()) return 'Location is required.';
    if (index === 3) {
      if (!date.trim() || !startTime.trim()) return 'Date and start time are required.';
      const start = combineLocalDateAndTime(date, startTime);
      if (!start) return 'Use a valid date (YYYY-MM-DD) and start time, such as 7:30 PM.';
      if (start.getTime() <= Date.now()) return 'Activity start time must be in the future.';
      const end = endTime.trim() ? combineLocalDateAndTime(date, endTime) : undefined;
      if (endTime.trim() && !end) return 'Use a valid end time, such as 9:30 PM.';
      if (end && end.getTime() <= start.getTime()) return 'End time must be after start time.';
    }
    if (index === 4 && (!Number.isInteger(Number(maxAttendees)) || Number(maxAttendees) < 2)) return 'Max participants must be at least 2.';
    if (index === 5) {
      if (description.trim().length < 20) return 'Description must be at least 20 characters.';
      if (costType === 'Paid' && (!Number.isFinite(Number(costAmount)) || Number(costAmount) <= 0)) return 'Enter a cost amount or choose Free.';
    }
    return undefined;
  };
  const firstInvalidStep = () => {
    for (let index = 0; index < 7; index++) {
      const message = validateStep(index);
      if (message) return { index, message };
    }
    return undefined;
  };

  const handleSubmit = async () => {
    if (publishing.current || step !== 7) return;
    setErrorMessage('');
    const invalid = firstInvalidStep();
    if (invalid) { setStep(invalid.index); return showError(invalid.message); }
    const capacity = Number(maxAttendees);
    const activityStart = combineLocalDateAndTime(date, startTime)!;
    const activityEnd = endTime.trim() ? combineLocalDateAndTime(date, endTime) : undefined;
    const normalizedCost = Number(costAmount);

    if (!token) {
      Alert.alert('Unauthorized', 'Log in to post an activity.');
      return;
    }

    publishing.current = true;
    setLoading(true);
    try {
      const geocodingQuery = [exactAddress.trim(), venueName.trim(), location.trim()]
        .filter(Boolean)
        .join(', ');
      const coordinate = await geocodeActivityLocation(geocodingQuery);
      const payload: Omit<Parameters<typeof createActivityRequest>[0], 'clientRequestId'> = {
          title: title.trim(),
          location: location.trim(),
          locationName: venueName.trim() || location.trim(),
          ...coordinate,
          isApproximateLocation: false,
          locationPrivacy: visibility === 'private' ? 'private' : 'public',
          venueName: venueName.trim(),
          exactAddress: exactAddress.trim(),
          category: category.trim(),
          description: description.trim(),
          date: activityStart.toISOString(),
          endDate: activityEnd?.toISOString(),
          maxAttendees: capacity,
          costType,
          costAmount: costType === 'Paid' ? normalizedCost : 0,
          currency: 'AUD',
          coverImageData: coverImage?.data,
          hostNote: hostNote.trim(),
          cancellationPolicy: cancellationPolicy.trim(),
          vibe,
          visibility,
          joinApproval: visibility === 'private' ? 'manual' : 'auto',
          ageGroup,
      };
      const fingerprint = JSON.stringify(payload);
      if (clientRequest.current?.fingerprint !== fingerprint) clientRequest.current = { fingerprint, id: Crypto.randomUUID() };
      await createActivityRequest({ ...payload, clientRequestId: clientRequest.current.id }, token);
      Alert.alert('Plan created', 'Your plan is live.');
      allowExit.current = true;
      navigation.navigate('Home');
    } catch (error: any) {
      reportFrontendError('activity_create_failed', error);
      showError(error?.response?.data?.message || 'Could not post activity. Please try again later.');
    } finally {
      publishing.current = false;
      setLoading(false);
    }
  };

  const hasDraft = Boolean(title || location || venueName || exactAddress || description || date || startTime || endTime || coverImage ||
    category !== 'Wellness' || maxAttendees !== '8' || visibility !== 'public' || vibe !== 'Laid-back' ||
    ageGroup !== 'any' || costType !== 'Free' || costAmount || hostNote || cancellationPolicy);

  const exitWizard = () => {
    allowExit.current = true;
    if (pendingExit.current) navigation.dispatch(pendingExit.current);
    else if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate('Home');
  };

  const cancelWizard = () => {
    if (publishing.current) return;
    if (hasDraft) setConfirmExit(true);
    else exitWizard();
  };

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowExit.current) return;
    event.preventDefault();
    if (publishing.current) return;
    if (step > 0) { setErrorMessage(''); setStep(step - 1); }
    else { pendingExit.current = event.data.action; cancelWizard(); }
  }), [navigation, step, hasDraft]);

  useEffect(() => {
    if (Platform.OS !== 'web' || !hasDraft || typeof window === 'undefined') return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (allowExit.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [hasDraft]);

  useEffect(() => {
    transition.stopAnimation();
    transition.setValue(0);
    const animation = Animated.timing(transition, { toValue: 1, duration: 220, useNativeDriver: true });
    animation.start();
    scroll.current?.scrollTo({ y: 0, animated: false });
    return () => animation.stop();
  }, [step, transition]);

  const goToStep = (next: number) => { if (!publishing.current) { setErrorMessage(''); setStep(next); } };
  useFocusEffect(React.useCallback(() => {
    if (Platform.OS !== 'android') return;
    // Handle Android back before native-stack dismisses the screen and its draft.
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (publishing.current) return true;
      if (step > 0) goToStep(step - 1);
      else cancelWizard();
      return true;
    });
    return () => subscription.remove();
  }, [step, hasDraft, navigation]));
  const nextStep = () => {
    const error = validateStep(step);
    if (error) { showError(error); return; }
    goToStep(Math.min(step + 1, 7));
  };
  const stepError = step === 7 ? firstInvalidStep()?.message : validateStep(step);
  const previewImage = coverImage?.uri || resolveActivityImage({ category });
  const timeLabel = (value: string) => activityTimeOptions.find(option => option.value === value)?.label || value;
  const reviewGroup = (label: string, index: number, children: React.ReactNode) => <View style={styles.reviewGroup}>
    <View style={styles.reviewHeader}><Text style={styles.label}>{label}</Text>
      <TouchableOpacity disabled={loading} accessibilityRole="button" accessibilityLabel={`Edit ${label.toLowerCase()}`} onPress={() => goToStep(index)}><Text style={styles.edit}>Edit</Text></TouchableOpacity>
    </View>{children}
  </View>;

  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.toolbar}>
        <Text style={styles.brand}>CREATE A PLAN</Text>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Cancel creation" disabled={loading} onPress={cancelWizard} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
      </View>
      <View style={styles.progressHeader}><Text style={styles.progressText} accessibilityLiveRegion="polite">{step + 1} of 8 · {wizardSteps[step].label}</Text></View>
      <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="Creation progress" accessibilityValue={{ min: 1, max: 8, now: step + 1 }}>
        <View style={[styles.progressFill, { width: `${((step + 1) / 8) * 100}%` }]} />
      </View>
      <ScrollView ref={scroll} style={styles.scroll} contentContainerStyle={[styles.content, step === 0 && styles.titleContent]} keyboardShouldPersistTaps="handled">
        <Animated.View key={step} style={{ opacity: transition, transform: [{ translateY: transition.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
          <Text style={[styles.heading, compact && styles.headingCompact]} accessibilityRole="header">{wizardSteps[step].title}</Text>
          <Text style={styles.subtitle}>{wizardSteps[step].hint}</Text>

          {step === 0 && <SoftTextInput accessibilityLabel="Activity title" value={title} onChangeText={setTitle} style={styles.titleInput} placeholder="Brew & Board Games" placeholderTextColor={colors.textSubtle} returnKeyType="next" onSubmitEditing={nextStep} />}

          {step === 1 && <View style={styles.categoryGrid}>{categoryOptions.map(option => <ChoiceCard key={option} label={option} selected={category === option} onPress={() => setCategory(option)} style={styles.category} />)}</View>}

          {step === 2 && <>
            <Text style={styles.label}>Location *</Text><SoftTextInput accessibilityLabel="Location" value={location} onChangeText={setLocation} style={styles.input} placeholder="e.g. Northbridge" placeholderTextColor={colors.textSubtle} />
            <Text style={styles.label}>Venue name</Text><SoftTextInput accessibilityLabel="Venue name" value={venueName} onChangeText={setVenueName} style={styles.input} placeholder="e.g. Shadow Wine Bar" placeholderTextColor={colors.textSubtle} />
            <Text style={styles.label}>Meeting point</Text><SoftTextInput accessibilityLabel="Meeting point" value={exactAddress} onChangeText={setExactAddress} style={styles.input} placeholder="Street address or easy place to meet" placeholderTextColor={colors.textSubtle} />
          </>}

          {step === 3 && <>
            <ActivityDateSelector value={date} onChange={setDate} />
            <View style={[styles.timeRow, compact && styles.timeColumn]}>
              <View style={styles.column}><ActivityTimeSelector label="Start time" value={startTime} onChange={setStartTime} /></View>
              <View style={styles.column}><ActivityTimeSelector label="End time" value={endTime} onChange={setEndTime} optional /></View>
            </View>
          </>}

          {step === 4 && <>
            <ParticipantStepper value={maxAttendees} onChange={setMaxAttendees} />
            {(['public', 'private'] as const).map(value => <ChoiceCard key={value} label={value === 'public' ? 'Public activity' : 'Private activity'} selected={visibility === value} onPress={() => setVisibility(value)} style={styles.privacy}
              description={value === 'public' ? 'Anyone nearby can discover and join immediately.' : 'People send a request first. You approve or decline before chat unlocks.'} />)}
          </>}

          {step === 5 && <>
            <Text style={styles.label}>Description * · min 20 characters</Text><SoftTextInput accessibilityLabel="Description" value={description} onChangeText={setDescription} style={[styles.input, styles.textArea]} placeholder="Tell people what makes this plan special." placeholderTextColor={colors.textSubtle} multiline />
            <TouchableOpacity style={styles.detailsToggle} accessibilityRole="button" accessibilityState={{ expanded: moreDetailsOpen }} onPress={() => setMoreDetailsOpen(value => !value)}><Text style={styles.detailsText}>More details</Text><Ionicons name={moreDetailsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} /></TouchableOpacity>
            {moreDetailsOpen && <ActivityOptionalDetails vibe={vibe} onVibeChange={setVibe} ageGroup={ageGroup} onAgeGroupChange={setAgeGroup}
              costType={costType} onCostTypeChange={setCostType} costAmount={costAmount} onCostAmountChange={setCostAmount}
              hostNote={hostNote} onHostNoteChange={setHostNote} cancellationPolicy={cancellationPolicy} onCancellationChange={setCancellationPolicy} />}
          </>}

          {step === 6 && <>
            <View style={styles.cover}><Image accessibilityLabel="Activity cover preview" source={{ uri: previewImage }} style={styles.coverImage} />{!coverImage && <View style={styles.defaultBadge}><Text style={styles.badgeText}>{category} default</Text></View>}</View>
            <View style={styles.coverActions}><TouchableOpacity style={styles.secondary} accessibilityRole="button" disabled={imagePicking} onPress={() => chooseActivityPhotoSource(selectActivityImage)}><Text style={styles.secondaryText}>{imagePicking ? 'Preparing picture…' : coverImage ? 'Change picture' : 'Choose picture'}</Text></TouchableOpacity>
              {coverImage && <TouchableOpacity style={styles.secondary} accessibilityRole="button" disabled={imagePicking} onPress={() => setCoverImage(undefined)}><Text style={styles.removeText}>Remove</Text></TouchableOpacity>}
            </View>
          </>}

          {step === 7 && <>
            <Image accessibilityLabel="Review cover image" source={{ uri: previewImage }} style={styles.reviewCover} />
            {reviewGroup('Title', 0, <Text style={styles.reviewTitle}>{title.trim()}</Text>)}
            {reviewGroup('Category', 1, <Text style={styles.reviewValue}>{category}</Text>)}
            {reviewGroup('Location', 2, <><Text style={styles.reviewValue}>{location.trim()}</Text>{venueName.trim() ? <Text style={styles.helper}>{venueName.trim()}</Text> : null}{exactAddress.trim() ? <Text style={styles.helper}>{exactAddress.trim()}</Text> : null}</>)}
            {reviewGroup('Date and time', 3, <><Text style={styles.reviewValue}>{formatActivityDate(date)}</Text><Text style={styles.helper}>{timeLabel(startTime)}{endTime ? ` – ${timeLabel(endTime)}` : ' · No end time'}</Text><Text style={styles.helper}>Local time</Text></>)}
            {reviewGroup('Participation', 4, <Text style={styles.reviewValue}>{maxAttendees} participants · {visibility === 'private' ? 'Private activity' : 'Public activity'}</Text>)}
            {reviewGroup('Description and details', 5, <><Text style={styles.reviewValue}>{description.trim()}</Text><Text style={styles.helper}>{vibe} · {ageGroupOptions.find(option => option.value === ageGroup)?.label} · {costType === 'Paid' ? `AUD ${costAmount}` : 'Free'}</Text>{hostNote.trim() ? <Text style={styles.helper}>Host note: {hostNote.trim()}</Text> : null}{cancellationPolicy.trim() ? <Text style={styles.helper}>Cancellation note: {cancellationPolicy.trim()}</Text> : null}</>)}
            {reviewGroup('Cover image', 6, <Text style={styles.helper}>{coverImage ? 'Your chosen picture' : `${category} category default`}</Text>)}
          </>}
        </Animated.View>
      </ScrollView>
      <View style={styles.footer}>
        <Text style={[styles.validationHint, errorMessage ? styles.error : undefined]} accessibilityRole={errorMessage ? 'alert' : undefined} accessibilityLiveRegion="polite">{errorMessage || stepError || (step === 7 ? 'Ready when you are.' : 'Your details stay with you as you go.')}</Text>
        <View style={styles.footerActions}>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back" disabled={loading || imagePicking} style={styles.back} onPress={() => step > 0 ? goToStep(step - 1) : cancelWizard()}><Ionicons name="arrow-back" size={18} color={colors.text} /><Text style={styles.secondaryText}>Back</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel={step === 7 ? 'Publish plan' : 'Next'} accessibilityState={{ disabled: Boolean(stepError) || loading || imagePicking, busy: loading }} disabled={Boolean(stepError) || loading || imagePicking} style={[styles.primary, (Boolean(stepError) || loading || imagePicking) && styles.disabled]} onPress={step === 7 ? handleSubmit : nextStep}>
            <Text style={styles.primaryText}>{loading ? 'Publishing...' : step === 7 ? 'Publish plan' : 'Next'}</Text><Ionicons name="arrow-forward" size={18} color={colors.primaryText} />
          </TouchableOpacity>
        </View>
      </View>
      <Modal visible={confirmExit} transparent animationType="fade" onRequestClose={() => setConfirmExit(false)}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard} accessibilityViewIsModal>
          <Text style={styles.modalTitle}>Discard this draft?</Text><Text style={styles.subtitle}>Your plan has not been published. Leaving will clear these details.</Text>
          <TouchableOpacity accessibilityRole="button" style={[styles.primary, { flex: 0 }]} onPress={() => { pendingExit.current = undefined; setConfirmExit(false); }}><Text style={styles.primaryText}>Keep editing</Text></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" style={styles.secondary} onPress={exitWizard}><Text style={styles.removeText}>Discard draft</Text></TouchableOpacity>
        </View></View>
      </Modal>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0B0B0B' },
  toolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, minHeight: 56 },
  brand: { color: colors.textSubtle, fontSize: 10, fontWeight: '800', letterSpacing: 2.5 },
  cancel: { paddingVertical: 14, paddingLeft: 20 }, cancelText: { color: colors.textMuted, fontSize: 14 },
  progressHeader: { paddingHorizontal: 24, paddingBottom: 14 }, progressText: { color: colors.textMuted, fontSize: 12, letterSpacing: 0.5 },
  progressTrack: { height: 2, backgroundColor: colors.border }, progressFill: { height: 2, backgroundColor: colors.primary },
  scroll: { flex: 1 }, content: { flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32 }, titleContent: { justifyContent: 'center' },
  heading: { color: colors.text, fontSize: 44, lineHeight: 50, fontWeight: '900', letterSpacing: -1.6, marginBottom: 14 }, headingCompact: { fontSize: 36, lineHeight: 42 },
  subtitle: { color: colors.textMuted, fontSize: 15, lineHeight: 23, marginBottom: 30 },
  titleInput: { color: colors.text, fontSize: 26, lineHeight: 36, backgroundColor: 'transparent', borderRadius: 0, borderWidth: 0, borderBottomWidth: 1, borderBottomColor: colors.borderStrong, paddingHorizontal: 0, paddingVertical: 16 },
  label: { color: colors.textMuted, fontSize: 12, fontWeight: '700', marginTop: 18, marginBottom: 10 },
  input: { color: colors.text, backgroundColor: colors.surfaceSoft, borderRadius: 20, padding: 18, minHeight: 60, fontSize: 17 }, textArea: { minHeight: 170, textAlignVertical: 'top', lineHeight: 25 },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, category: { width: '47.5%', minHeight: 100 },
  timeRow: { flexDirection: 'row', gap: 16 }, timeColumn: { flexDirection: 'column', gap: 0 }, column: { flex: 1 },
  privacy: { marginBottom: 14 },
  helper: { color: colors.textMuted, fontSize: 14, lineHeight: 23, marginTop: 6 },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 58, marginTop: 18 }, detailsText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  cover: { aspectRatio: 16 / 9, borderRadius: 18, overflow: 'hidden', backgroundColor: colors.surface }, coverImage: { width: '100%', height: '100%' }, defaultBadge: { position: 'absolute', bottom: 12, left: 12, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999 }, badgeText: { color: colors.text, fontSize: 12 }, coverActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  reviewCover: { width: '100%', aspectRatio: 16 / 9, borderRadius: 18, backgroundColor: colors.surface }, reviewGroup: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }, reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }, edit: { color: colors.textMuted, fontSize: 12, paddingVertical: 12, paddingLeft: 12 }, reviewTitle: { color: colors.text, fontSize: 25, fontWeight: '800', marginBottom: 12 }, reviewValue: { color: colors.text, fontSize: 16, lineHeight: 25, marginBottom: 10 },
  footer: { width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 18 }, validationHint: { minHeight: 34, color: colors.textSubtle, fontSize: 12, lineHeight: 18, paddingBottom: 10 }, footerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 54, paddingRight: 14 }, primary: { flex: 1, minHeight: 54, borderRadius: 999, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: colors.primary }, primaryText: { color: colors.primaryText, fontSize: 15, fontWeight: '900' }, disabled: { opacity: 0.35 },
  secondary: { minHeight: 48, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }, secondaryText: { color: colors.text, fontSize: 14, fontWeight: '700' }, removeText: { color: colors.danger, fontSize: 14, fontWeight: '700' }, error: { color: colors.danger, lineHeight: 22, marginBottom: 20 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', padding: 24 }, modalCard: { width: '100%', maxWidth: 420, borderRadius: 22, padding: 28, backgroundColor: colors.surface }, modalTitle: { color: colors.text, fontSize: 25, fontWeight: '800', marginBottom: 12 },
});
