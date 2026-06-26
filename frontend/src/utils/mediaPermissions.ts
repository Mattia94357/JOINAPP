import { Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export const photoAccessDeniedMessage = 'JOIN needs photo access so you can upload a profile picture.';

export type PhotoSource = 'camera' | 'library';

const debugPhotoUpload = (event: string, details?: Record<string, unknown>) => {
  if (__DEV__) console.info(`[JOIN photo] ${event}`, details || {});
};

export const requestPhotoPermission = async (source: PhotoSource) => {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

  if (!permission.granted) {
    debugPhotoUpload('permission denied', { source, status: permission.status });
    Alert.alert('Photo access needed', photoAccessDeniedMessage);
    return false;
  }

  debugPhotoUpload('permission granted', { source, status: permission.status });
  return true;
};

export const pickProfileImage = async (source: PhotoSource) => {
  const hasPermission = await requestPhotoPermission(source);
  if (!hasPermission) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.75,
    base64: false,
    exif: false,
  };

  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  if (result.canceled || !result.assets?.length) {
    debugPhotoUpload('image selection cancelled', { source });
    return null;
  }

  const asset = result.assets[0];
  debugPhotoUpload('image selected', {
    source,
    width: asset.width,
    height: asset.height,
    fileSize: asset.fileSize,
    hasBase64: Boolean(asset.base64),
  });

  const largestSide = Math.max(asset.width || 0, asset.height || 0);
  const resizedSide = largestSide > 1024 ? 1024 : largestSide;
  const resized = await ImageManipulator.manipulateAsync(
    asset.uri,
    resizedSide ? [{ resize: { width: resizedSide } }] : [],
    {
      compress: 0.72,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  debugPhotoUpload('image prepared', {
    width: resized.width,
    height: resized.height,
    payloadBytes: resized.base64 ? Math.ceil((resized.base64.length * 3) / 4) : 0,
  });

  return {
    ...asset,
    uri: resized.uri,
    width: resized.width,
    height: resized.height,
    base64: resized.base64,
    mimeType: 'image/jpeg',
  } as ImagePicker.ImagePickerAsset;
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
