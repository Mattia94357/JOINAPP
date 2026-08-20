import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { requestPhotoPermission } from './mediaPermissions';

export const MAX_MOMENT_IMAGES = 3;
const MAX_IMAGE_BYTES = 1536 * 1024;

export const pickMomentImages = async () => {
  const permitted = await requestPhotoPermission('library');
  if (!permitted) return [];

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true,
    selectionLimit: MAX_MOMENT_IMAGES,
    quality: 0.7,
    base64: false,
    exif: false,
  });
  if (result.canceled || !result.assets?.length) return [];

  const images = await Promise.all(result.assets.slice(0, MAX_MOMENT_IMAGES).map(async (asset) => {
    const largestSide = Math.max(asset.width || 0, asset.height || 0);
    const resize = largestSide > 1280 ? [{ resize: { width: 1280 } }] : [];
    const prepared = await ImageManipulator.manipulateAsync(asset.uri, resize, {
      compress: 0.68,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    });
    if (!prepared.base64 || Math.ceil((prepared.base64.length * 3) / 4) > MAX_IMAGE_BYTES) {
      throw new Error('Each Moment photo must be 1.5MB or smaller after processing.');
    }
    return `data:image/jpeg;base64,${prepared.base64}`;
  }));

  return images;
};
