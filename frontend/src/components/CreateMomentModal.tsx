import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createMomentRequest, MomentResponse } from '../api';
import { colors, spacing } from '../theme';
import { MAX_MOMENT_IMAGES, pickMomentImages } from '../utils/momentMedia';

type Props = {
  visible: boolean;
  activityId: string;
  activityTitle: string;
  token: string;
  onClose: () => void;
  onCreated: (moment: MomentResponse) => void;
};

export default function CreateMomentModal({ visible, activityId, activityTitle, token, onClose, onCreated }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);

  const chooseImages = async () => {
    setPreparing(true);
    try {
      setImages(await pickMomentImages());
    } catch (error: any) {
      Alert.alert('Photo unavailable', error?.message || 'Choose another photo and try again.');
    } finally {
      setPreparing(false);
    }
  };

  const submit = async () => {
    if (!images.length || saving) return;
    setSaving(true);
    try {
      const response = await createMomentRequest(activityId, images, caption.trim(), token);
      onCreated(response.data);
      setImages([]);
      setCaption('');
      onClose();
    } catch (error: any) {
      Alert.alert('Moment not saved', error?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>ACTIVITY MOMENT</Text>
              <Text style={styles.title}>Remember {activityTitle}</Text>
            </View>
            <TouchableOpacity style={styles.close} onPress={onClose}><Ionicons name="close" size={20} color={colors.text} /></TouchableOpacity>
          </View>
          <Text style={styles.context}>Moments are memories from activities you genuinely joined or hosted.</Text>

          {images.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
              {images.map((image, index) => <Image key={index} source={{ uri: image }} style={styles.preview} />)}
            </ScrollView>
          ) : (
            <TouchableOpacity style={styles.photoPicker} onPress={chooseImages} disabled={preparing}>
              {preparing ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="images-outline" size={28} color={colors.primary} />}
              <Text style={styles.photoTitle}>{preparing ? 'Preparing photos...' : 'Choose activity photos'}</Text>
              <Text style={styles.photoHint}>Add up to {MAX_MOMENT_IMAGES} photos</Text>
            </TouchableOpacity>
          )}

          {images.length ? <TouchableOpacity style={styles.changePhotos} onPress={chooseImages}><Text style={styles.changePhotosText}>Change photos</Text></TouchableOpacity> : null}
          <TextInput
            value={caption}
            onChangeText={setCaption}
            maxLength={280}
            multiline
            placeholder="A short note about what happened (optional)"
            placeholderTextColor={colors.textSubtle}
            style={styles.caption}
          />
          <Text style={styles.counter}>{caption.length}/280</Text>
          <TouchableOpacity style={[styles.save, (!images.length || saving) && styles.saveDisabled]} onPress={submit} disabled={!images.length || saving}>
            {saving ? <ActivityIndicator color={colors.primaryText} /> : <><Ionicons name="camera-outline" size={17} color={colors.primaryText} /><Text style={styles.saveText}>Add Moment</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,.72)' },
  sheet: { width: '100%', maxWidth: 520, alignSelf: 'center', maxHeight: '92%', padding: spacing.lg, paddingBottom: 30, borderTopLeftRadius: 26, borderTopRightRadius: 26, borderWidth: 1, borderColor: colors.goldBorder, backgroundColor: colors.background },
  handle: { width: 42, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: colors.border, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center' },
  headerCopy: { flex: 1 },
  eyebrow: { color: colors.primary, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.text, fontSize: 22, fontWeight: '900', marginTop: 3 },
  close: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  context: { color: colors.textMuted, fontSize: 12, lineHeight: 18, marginTop: spacing.sm, marginBottom: spacing.md },
  photoPicker: { minHeight: 170, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.goldBorder, backgroundColor: colors.surface },
  photoTitle: { color: colors.text, fontSize: 14, fontWeight: '900', marginTop: spacing.sm },
  photoHint: { color: colors.textSubtle, fontSize: 11, marginTop: 3 },
  previewRow: { marginBottom: spacing.sm },
  preview: { width: 180, height: 180, borderRadius: 14, marginRight: spacing.sm, backgroundColor: colors.surfaceElevated },
  changePhotos: { alignSelf: 'flex-end', paddingVertical: spacing.xs },
  changePhotosText: { color: colors.primary, fontSize: 12, fontWeight: '900' },
  caption: { minHeight: 100, marginTop: spacing.sm, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: spacing.md, color: colors.text, backgroundColor: colors.surface, textAlignVertical: 'top' },
  counter: { color: colors.textSubtle, fontSize: 10, textAlign: 'right', marginTop: 4 },
  save: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderRadius: 14, backgroundColor: colors.primary, marginTop: spacing.md },
  saveDisabled: { opacity: .45 },
  saveText: { color: colors.primaryText, fontSize: 14, fontWeight: '900', marginLeft: spacing.sm },
});
