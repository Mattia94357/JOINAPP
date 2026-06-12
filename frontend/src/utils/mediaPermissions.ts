import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

export const photoAccessDeniedMessage = 'JOIN needs photo access so you can upload a profile picture.';

export type PhotoSource = 'camera' | 'library';

export const requestPhotoPermission = async (source: PhotoSource) => {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    Alert.alert('Photo access needed', photoAccessDeniedMessage);
    return false;
  }

  return true;
};

export const pickProfileImage = async (source: PhotoSource) => {
  const hasPermission = await requestPhotoPermission(source);
  if (!hasPermission) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.55,
    base64: true,
    exif: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) return null;
  return result.assets[0];
};

export const choosePhotoSource = (onSelect: (source: PhotoSource) => void) => {
  if (Platform.OS === 'web') {
    onSelect('library');
    return;
  }

  Alert.alert('Profile photo', 'Add a photo so people can see who is joining.', [
    { text: 'Take photo', onPress: () => onSelect('camera') },
    { text: 'Choose from library', onPress: () => onSelect('library') },
    { text: 'Cancel', style: 'cancel' },
  ]);
};
