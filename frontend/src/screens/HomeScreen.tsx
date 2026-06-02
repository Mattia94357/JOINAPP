import React, { useEffect, useMemo, useState } from 'react';
import {
SafeAreaView,
View,
Text,
TouchableOpacity,
StyleSheet,
ActivityIndicator,
Alert,
Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../App';
import AvatarBadge from '../components/AvatarBadge';
import SwipeDeck from '../components/SwipeDeck';
import ParticipantsModal from '../components/ParticipantsModal';
import { useAuth } from '../context/AuthContext';
import { ActivityResponse, fetchActivities, joinActivityRequest } from '../api';
import { curatedActivities } from '../utils/curatedActivities';
import { colors, spacing } from '../theme';

const categories = ['All', 'Wellness', 'Food', 'Networking', 'Adventure'];

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
const { user, token } = useAuth();

const [selectedCategory, setSelectedCategory] = useState('All');
const [categoryModalVisible, setCategoryModalVisible] = useState(false);
const [activities, setActivities] = useState<ActivityResponse[]>([]);
const [loading, setLoading] = useState(true);
const [message, setMessage] = useState('');
const [participantsActivity, setParticipantsActivity] = useState<ActivityResponse | null>(null);

const filteredActivities = useMemo(
() =>
activities.filter((activity) => {
return selectedCategory === 'All' || activity.category === selectedCategory;
}),
[activities, selectedCategory],
);

useEffect(() => {
const load = async () => {
setLoading(true);
setMessage('');

```
  try {
    const result = await fetchActivities(token || undefined);
    setActivities(result);
  } catch (error) {
    setMessage('Unable to fetch activities. Showing curated plans instead.');
  } finally {
    setLoading(false);
  }
};

load();
```

}, [token]);

const refreshActivities = async () => {
try {
const result = await fetchActivities(token || undefined);
setActivities(result);
} catch (error) {
console.warn(error);
}
};

const handleJoinActivity = async (activity: ActivityResponse) => {
if (!token) {
Alert.alert('Sign in required', 'Please log in to join this activity.');
return;
}

```
if (!user?.profileCompleted && !user?.profilePictureUrl && !user?.avatar) {
  Alert.alert(
    'Profile photo required',
    'Profile photos are required before joining. This helps everyone see who is attending and keeps JOIN trusted.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Upload photo', onPress: () => navigation.navigate('Profile') },
    ],
  );
  return;
}

try {
  await joinActivityRequest(activity.id, token);
  Alert.alert('Joined', `You joined ${activity.title}.`);
  await refreshActivities();
} catch (error) {
  console.warn(error);
  Alert.alert('Unable to join', 'There was an issue joining this activity.');
}
```

};

const handlePress = (activity: ActivityResponse) => {
navigation.navigate('Activity', { activityId: activity.id });
};

const activeFeed = filteredActivities.length > 0 ? filteredActivities : curatedActivities;

return ( <SafeAreaView style={styles.container}> <View style={styles.topBar}> <View style={styles.headingBlock}> <Text style={styles.greeting}>Hello, {user?.name || 'guest'}</Text> <Text style={styles.title}>Find your next plan</Text> </View>

```
    <View style={styles.actionIcons}>
      <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.iconButton}>
        <Ionicons name="notifications-outline" size={21} color={colors.text} />
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.navigate('Profile')} style={styles.iconButton}>
        <AvatarBadge
          name={user?.name || 'Guest'}
          avatarUrl={user?.profilePictureUrl || user?.avatar}
          size={38}
        />
      </TouchableOpacity>
    </View>
  </View>

  <View style={styles.cleanControls}>
    <TouchableOpacity
      style={styles.browseCategoriesButton}
      onPress={() => setCategoryModalVisible(true)}
    >
      <Ionicons name="grid-outline" size={17} color={colors.primaryText} />
      <Text style={styles.browseCategoriesText}>
        Browse Categories{selectedCategory !== 'All' ? ` · ${selectedCategory}` : ''}
      </Text>
    </TouchableOpacity>

    <TouchableOpacity
      style={styles.hostButtonSmall}
      onPress={() => navigation.navigate('CreateActivity')}
    >
      <Ionicons name="add-outline" size={22} color={colors.text} />
    </TouchableOpacity>
  </View>

  <View style={styles.deckContainer}>
    {loading ? (
      <ActivityIndicator color={colors.primary} size="large" />
    ) : (
      <SwipeDeck
        key={`${selectedCategory}-${activeFeed.length}`}
        activities={activeFeed}
        onSwipeLeft={() => setMessage('Saved for later. Keep browsing quality plans.')}
        onSwipeRight={handleJoinActivity}
        onPress={handlePress}
        onViewParticipants={setParticipantsActivity}
        onOpenProfile={(participant) =>
          navigation.navigate('PublicProfile', {
            userId: participant.id,
            fallbackName: participant.name,
            fallbackAvatar: participant.avatar,
          })
        }
      />
    )}
  </View>

  {message ? <Text style={styles.statusText}>{message}</Text> : null}

  <ParticipantsModal
    visible={Boolean(participantsActivity)}
    participants={participantsActivity?.participants || []}
    onClose={() => setParticipantsActivity(null)}
    onOpenProfile={(participant) => {
      setParticipantsActivity(null);
      navigation.navigate('PublicProfile', {
        userId: participant.id,
        fallbackName: participant.name,
        fallbackAvatar: participant.avatar,
      });
    }}
  />

  <Modal
    visible={categoryModalVisible}
    transparent
    animationType="fade"
    onRequestClose={() => setCategoryModalVisible(false)}
  >
    <View style={styles.modalOverlay}>
      <View style={styles.categoryModal}>
        <Text style={styles.modalTitle}>Browse Categories</Text>

        {categories.map((category) => (
          <TouchableOpacity
            key={category}
            style={[
              styles.modalCategoryItem,
              selectedCategory === category && styles.modalCategoryItemActive,
            ]}
            onPress={() => {
              setSelectedCategory(category);
              setCategoryModalVisible(false);
            }}
          >
            <Text
              style={[
                styles.modalCategoryText,
                selectedCategory === category && styles.modalCategoryTextActive,
              ]}
            >
              {category}
            </Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.modalCloseButton}
          onPress={() => setCategoryModalVisible(false)}
        >
          <Text style={styles.modalCloseText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
</SafeAreaView>
```

);
}

const styles = StyleSheet.create({
container: {
flex: 1,
backgroundColor: colors.background,
paddingHorizontal: spacing.lg,
paddingTop: spacing.md,
},
topBar: {
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'space-between',
marginBottom: spacing.lg,
},
headingBlock: {
flex: 1,
paddingRight: spacing.md,
},
greeting: {
color: colors.textMuted,
fontSize: 13,
marginBottom: spacing.xs,
fontWeight: '700',
},
title: {
color: colors.text,
fontSize: 28,
fontWeight: '900',
lineHeight: 33,
},
actionIcons: {
flexDirection: 'row',
alignItems: 'center',
},
iconButton: {
marginLeft: spacing.md,
justifyContent: 'center',
alignItems: 'center',
width: 42,
height: 42,
borderRadius: 10,
backgroundColor: colors.surface,
borderWidth: 1,
borderColor: colors.border,
},
cleanControls: {
flexDirection: 'row',
alignItems: 'center',
gap: spacing.sm,
marginBottom: spacing.md,
},
browseCategoriesButton: {
flex: 1,
backgroundColor: colors.primary,
borderRadius: 12,
paddingVertical: 14,
paddingHorizontal: spacing.md,
flexDirection: 'row',
alignItems: 'center',
justifyContent: 'center',
},
browseCategoriesText: {
color: colors.primaryText,
fontWeight: '900',
marginLeft: spacing.sm,
},
hostButtonSmall: {
width: 48,
height: 48,
borderRadius: 12,
backgroundColor: colors.surface,
borderWidth: 1,
borderColor: colors.border,
alignItems: 'center',
justifyContent: 'center',
},
deckContainer: {
flex: 1,
marginTop: spacing.sm,
},
statusText: {
color: colors.textMuted,
textAlign: 'center',
marginBottom: spacing.md,
fontWeight: '700',
},
modalOverlay: {
flex: 1,
backgroundColor: 'rgba(0,0,0,0.72)',
justifyContent: 'center',
padding: spacing.lg,
},
categoryModal: {
backgroundColor: colors.surface,
borderRadius: 18,
padding: spacing.lg,
borderWidth: 1,
borderColor: colors.border,
},
modalTitle: {
color: colors.text,
fontSize: 22,
fontWeight: '900',
marginBottom: spacing.md,
},
modalCategoryItem: {
paddingVertical: 14,
paddingHorizontal: spacing.md,
borderRadius: 10,
borderWidth: 1,
borderColor: colors.border,
marginBottom: spacing.sm,
backgroundColor: colors.background,
},
modalCategoryItemActive: {
backgroundColor: colors.primary,
borderColor: colors.primary,
},
modalCategoryText: {
color: colors.text,
fontWeight: '800',
},
modalCategoryTextActive: {
color: colors.primaryText,
},
modalCloseButton: {
marginTop: spacing.sm,
paddingVertical: 14,
alignItems: 'center',
},
modalCloseText: {
color: colors.textMuted,
fontWeight: '800',
},
});
