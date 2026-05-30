import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import { useAuth } from '../context/AuthContext';
import { createActivityRequest } from '../api';

const categoryOptions = ['Wellness', 'Food', 'Networking', 'Adventure', 'Culture'];
const vibeOptions = ['Laid-back', 'Social', 'Creative', 'Active'];

type Props = NativeStackScreenProps<RootStackParamList, 'CreateActivity'>;

export default function CreateActivityScreen({ navigation }: Props) {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [category, setCategory] = useState('Wellness');
  const [vibe, setVibe] = useState('Laid-back');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !location.trim() || !category.trim() || !description.trim()) {
      Alert.alert('Missing information', 'Please fill in all fields before posting your activity.');
      return;
    }

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
          category: category.trim(),
          description: description.trim(),
          date: date.trim(),
          vibe,
        },
        token,
      );
      Alert.alert('Activity created', 'Your activity is now live in the feed.');
      navigation.navigate('Home');
    } catch (error) {
      console.warn(error);
      Alert.alert('Could not post activity', 'Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.sectionTitle}>Create a premium activity</Text>
      <Text style={styles.sectionDescription}>
        Make your plan stand out by choosing a category, vibe and a compelling location.
      </Text>

      <Text style={styles.label}>Activity Title</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={styles.input}
        placeholder="e.g. Brew & Board Games"
        placeholderTextColor="#777"
      />

      <Text style={styles.label}>Location</Text>
      <TextInput
        value={location}
        onChangeText={setLocation}
        style={styles.input}
        placeholder="e.g. Central Park"
        placeholderTextColor="#777"
      />

      <Text style={styles.label}>Category</Text>
      <View style={styles.row}> 
        {categoryOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.choiceChip, category === option && styles.choiceChipActive]}
            onPress={() => setCategory(option)}
          >
            <Text style={[styles.choiceLabel, category === option && styles.choiceLabelActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Vibe</Text>
      <View style={styles.row}>
        {vibeOptions.map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.choiceChip, vibe === option && styles.choiceChipActive]}
            onPress={() => setVibe(option)}
          >
            <Text style={[styles.choiceLabel, vibe === option && styles.choiceLabelActive]}>{option}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Date / Time</Text>
      <TextInput
        value={date}
        onChangeText={setDate}
        style={styles.input}
        placeholder="Saturday, 5:30 PM"
        placeholderTextColor="#777"
      />

      <Text style={styles.label}>Description</Text>
      <TextInput
        value={description}
        onChangeText={setDescription}
        style={[styles.input, styles.textArea]}
        placeholder="Tell people what makes this event special"
        placeholderTextColor="#777"
        multiline
      />

      <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Posting...' : 'Publish experience'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050505',
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 6,
  },
  sectionDescription: {
    color: '#aaa',
    lineHeight: 22,
    marginBottom: 22,
  },
  label: {
    color: '#eee',
    marginBottom: 8,
    marginTop: 18,
    fontSize: 14,
  },
  input: {
    backgroundColor: '#111',
    color: '#fff',
    borderColor: '#222',
    borderWidth: 1,
    borderRadius: 18,
    padding: 16,
    fontSize: 16,
  },
  textArea: {
    minHeight: 140,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  choiceChip: {
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: '#111',
  },
  choiceChipActive: {
    borderColor: '#f5c12d',
    backgroundColor: '#f5c12d',
  },
  choiceLabel: {
    color: '#ddd',
    fontSize: 14,
    fontWeight: '600',
  },
  choiceLabelActive: {
    color: '#050505',
  },
  button: {
    marginTop: 30,
    backgroundColor: '#f5c12d',
    borderRadius: 20,
    padding: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#050505',
    fontWeight: '800',
    fontSize: 16,
  },
});
