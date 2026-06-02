import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, Platform } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { createActivityRequest } from '../api';
import { colors, spacing } from '../theme';

const categoryOptions = ['Wellness', 'Food', 'Networking', 'Adventure', 'Culture'];
const vibeOptions = ['Laid-back', 'Social', 'Creative', 'Active'];

type Props = NativeStackScreenProps<RootStackParamList, 'CreateActivity'>;

export default function CreateActivityScreen({ navigation }: Props) {
  const { token } = useAuth();
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
  const [coverImage, setCoverImage] = useState('');
  const [hostNote, setHostNote] = useState('');
  const [cancellationPolicy, setCancellationPolicy] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const showError = (message: string) => {
    setErrorMessage(message);
    if (Platform.OS !== 'web') Alert.alert('Check details', message);
  };

  const handleSubmit = async () => {
    setErrorMessage('');
    const capacity = Number(maxAttendees);

    if (!title.trim()) return showError('Activity title is required.');
    if (!location.trim()) return showError('Location is required.');
    if (!date.trim() || !startTime.trim()) return showError('Date and start time are required.');
    if (!Number.isInteger(capacity) || capacity < 2) return showError('Max participants must be at least 2.');
    if (description.trim().length < 20) return showError('Description must be at least 20 characters.');
    if (costType === 'Paid' && Number(costAmount || 0) <= 0) return showError('Enter a cost amount or choose Free.');

    if (!token) {
      Alert.alert('Unauthorized', 'Log in to post an activity.');
      return;
    }

    setLoading(true);
    try {
      await createActivityRequest(
        {
          title: title.trim(),
          location: location.trim(),
          venueName: venueName.trim(),
          exactAddress: exactAddress.trim(),
          category: category.trim(),
          description: description.trim(),
          date: date.trim(),
          startTime: startTime.trim(),
          endTime: endTime.trim(),
          maxAttendees: capacity,
          costType,
          costAmount: costType === 'Paid' ? Number(costAmount) : 0,
          currency: 'AUD',
          coverImage: coverImage.trim(),
          hostNote: hostNote.trim(),
          cancellationPolicy: cancellationPolicy.trim(),
          vibe,
        },
        token,
      );
      Alert.alert('Activity created', 'Your activity is now live in the feed.');
      navigation.navigate('Home');
    } catch (error: any) {
      console.warn(error);
      showError(error?.response?.data?.message || 'Could not post activity. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <Text style={styles.sectionTitle}>Host an experience</Text>
      <Text style={styles.sectionDescription}>Add enough detail for people to trust the plan before they join.</Text>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Text style={styles.label}>Activity title *</Text>
      <TextInput value={title} onChangeText={setTitle} style={styles.input} placeholder="e.g. Brew & Board Games" placeholderTextColor={colors.textSubtle} />

      <Text style={styles.label}>Venue name</Text>
      <TextInput value={venueName} onChangeText={setVenueName} style={styles.input} placeholder="e.g. Shadow Wine Bar" placeholderTextColor={colors.textSubtle} />

      <Text style={styles.label}>Location *</Text>
      <TextInput value={location} onChangeText={setLocation} style={styles.input} placeholder="e.g. Northbridge" placeholderTextColor={colors.textSubtle} />

      <Text style={styles.label}>Exact address</Text>
      <TextInput value={exactAddress} onChangeText={setExactAddress} style={styles.input} placeholder="Street address or meeting point" placeholderTextColor={colors.textSubtle} />

      <Text style={styles.label}>Activity image URL</Text>
      <TextInput value={coverImage} onChangeText={setCoverImage} style={styles.input} placeholder="Paste image URL for now" placeholderTextColor={colors.textSubtle} autoCapitalize="none" />

      <Text style={styles.label}>Category</Text>
      <View style={styles.row}>
        {categoryOptions.map((option) => (
          <TouchableOpacity key={option} style={[styles.choiceChip, category === option && styles.choiceChipActive]} onPress={() => setCategory(option)}>
            <Text style={[styles.choiceLabel, category === option && styles.choiceLabelActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Vibe</Text>
      <View style={styles.row}>
        {vibeOptions.map((option) => (
          <TouchableOpacity key={option} style={[styles.choiceChip, vibe === option && styles.choiceChipActive]} onPress={() => setVibe(option)}>
            <Text style={[styles.choiceLabel, vibe === option && styles.choiceLabelActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.twoColumn}>
        <View style={styles.column}>
          <Text style={styles.label}>Date *</Text>
          <TextInput value={date} onChangeText={setDate} style={styles.input} placeholder="2026-06-05" placeholderTextColor={colors.textSubtle} />
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>Max participants *</Text>
          <TextInput value={maxAttendees} onChangeText={setMaxAttendees} style={styles.input} keyboardType="number-pad" placeholder="8" placeholderTextColor={colors.textSubtle} />
        </View>
      </View>

      <View style={styles.twoColumn}>
        <View style={styles.column}>
          <Text style={styles.label}>Start time *</Text>
          <TextInput value={startTime} onChangeText={setStartTime} style={styles.input} placeholder="7:30 PM" placeholderTextColor={colors.textSubtle} />
        </View>
        <View style={styles.column}>
          <Text style={styles.label}>End time</Text>
          <TextInput value={endTime} onChangeText={setEndTime} style={styles.input} placeholder="9:30 PM" placeholderTextColor={colors.textSubtle} />
        </View>
      </View>

      <Text style={styles.label}>Cost</Text>
      <View style={styles.row}>
        {(['Free', 'Paid'] as const).map((option) => (
          <TouchableOpacity key={option} style={[styles.choiceChip, costType === option && styles.choiceChipActive]} onPress={() => setCostType(option)}>
            <Text style={[styles.choiceLabel, costType === option && styles.choiceLabelActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {costType === 'Paid' && (
        <TextInput value={costAmount} onChangeText={setCostAmount} style={styles.input} keyboardType="decimal-pad" placeholder="Cost in AUD" placeholderTextColor={colors.textSubtle} />
      )}

      <Text style={styles.label}>Description * <Text style={styles.labelHint}>min 20 chars</Text></Text>
      <TextInput value={description} onChangeText={setDescription} style={[styles.input, styles.textArea]} placeholder="Tell people what makes this event special" placeholderTextColor={colors.textSubtle} multiline />

      <Text style={styles.label}>Host note</Text>
      <TextInput value={hostNote} onChangeText={setHostNote} style={styles.input} placeholder="Optional arrival, dress code or bring-along note" placeholderTextColor={colors.textSubtle} />

      <Text style={styles.label}>Cancellation note</Text>
      <TextInput value={cancellationPolicy} onChangeText={setCancellationPolicy} style={styles.input} placeholder="Optional cancellation or weather policy" placeholderTextColor={colors.textSubtle} />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Posting...' : 'Publish experience'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.lg,
    paddingBottom: 96,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    color: colors.textMuted,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  errorText: {
    color: colors.danger,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
    fontWeight: '700',
  },
  label: {
    color: colors.text,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
    fontSize: 14,
    fontWeight: '800',
  },
  labelHint: {
    color: colors.textSubtle,
    fontSize: 12,
  },
  input: {
    backgroundColor: colors.surface,
    color: colors.text,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: 15,
  },
  textArea: {
    minHeight: 112,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
  },
  twoColumn: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  column: {
    flex: 1,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  choiceChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  choiceLabel: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '800',
  },
  choiceLabelActive: {
    color: colors.primaryText,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.primaryText,
    fontWeight: '900',
    fontSize: 16,
  },
});
