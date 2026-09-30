import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { Button } from './Button';
import { submitArtisanWork } from '../services/apiClient';

const CATEGORIES = [
  { id: 'PAINTING_FINISHING', label: 'Painting, POP & Screeding 🎨' },
  { id: 'GENERAL_MASONRY', label: 'Floor & Wall Tiling, Terrazzo 🏛️' },
  { id: 'FURNITURE_CARPENTRY', label: 'Woodwork & Fluted Slats 🪵' },
  { id: 'LANDSCAPING_OUTDOOR', label: 'Compound Pavers & Kerbs 🧱' },
];

interface AddPortfolioModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (newCraft: any) => void;
}

export function AddPortfolioModal({ visible, onClose, onSuccess }: AddPortfolioModalProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].id);
  const [description, setDescription] = useState('');
  const [costNaira, setCostNaira] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pad = Math.max(width * 0.05, 16);
  const maxW = Math.min(width, 540);

  const pickImage = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        const uri = res.assets[0].uri;
        setTimeout(() => {
          setImageUri(uri);
        }, 50);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Unable to pick image.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera permission required to capture physical craft.');
        return;
      }

      const res = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!res.canceled && res.assets && res.assets[0]?.uri) {
        const uri = res.assets[0].uri;
        setTimeout(() => {
          setImageUri(uri);
        }, 50);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Unable to capture photo.');
    }
  };

  const handleSubmit = async () => {
    if (!imageUri) {
      Alert.alert('Photo Required', 'Please select or photograph your craft.');
      return;
    }
    if (!title.trim() || !description.trim()) {
      Alert.alert('Missing Details', 'Please provide a title and craft description.');
      return;
    }

    setSubmitting(true);
    try {
      // Convert to base64 on-demand for upload
      let payloadBase64 = imageBase64;
      if (!payloadBase64 || !payloadBase64.startsWith('data:')) {
        const raw = await FileSystem.readAsStringAsync(imageUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        payloadBase64 = `data:image/jpeg;base64,${raw}`;
        setImageBase64(payloadBase64);
      }

      const parsedCost = parseInt(costNaira.replace(/[^0-9]/g, ''), 10) || undefined;
      const res = await submitArtisanWork({
        imageUrl: payloadBase64,
        title: title.trim(),
        description: description.trim(),
        category,
        estimatedCostNaira: parsedCost,
      });

      Alert.alert(
        'Published! 🎉',
        'Your craft portfolio is now live on the Artisan Feed. Clients can contact you privately in-app.'
      );

      onSuccess(res.item);
      onClose();
    } catch (e: any) {
      Alert.alert(
        'Submission Error',
        e?.message || 'Could not submit craft portfolio. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: colors.bg }]}>
        {/* Header */}
        <View style={[styles.header, { paddingHorizontal: pad, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Submit Artisan Craft</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}>
          <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%', gap: 16 }}>

            {/* Image Picker */}
            {imageUri ? (
              <View key={`preview-${imageUri}`} style={styles.previewContainer}>
                <Image
                  key={`img-${imageUri}`}
                  source={{ uri: imageUri }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <TouchableOpacity
                  style={styles.changeBadge}
                  onPress={() => {
                    setImageUri(null);
                    setImageBase64(null);
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.changeBadgeText}>Change Photo ✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View
                style={[
                  styles.dropZone,
                  {
                    backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={{ fontSize: 40 }}>📸</Text>
                <Text style={[styles.dropTitle, { color: colors.text }]}>
                  Photograph Physical Work
                </Text>
                <Text style={[styles.dropSub, { color: colors.textSecondary }]}>
                  On-site installations or workshop photos
                </Text>
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: Colors.accent }]}
                    onPress={pickImage}
                  >
                    <Text style={styles.photoBtnText}>Pick from Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.photoBtn, { backgroundColor: isDark ? '#27272A' : '#E2E8F0' }]}
                    onPress={takePhoto}
                  >
                    <Text style={[styles.photoBtnText, { color: colors.text }]}>Snap Live Photo</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Title */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Craft Project Title</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. Fluted Teak Feature Wall with LED Channels"
                placeholderTextColor={colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Category */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Trade Specialty</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {CATEGORIES.map(cat => {
                  const isSelected = category === cat.id;
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.catChip,
                        {
                          backgroundColor: isSelected ? Colors.accent : isDark ? '#27272A' : '#F1F5F9',
                          borderColor: isSelected ? Colors.accent : colors.border,
                        },
                      ]}
                      onPress={() => setCategory(cat.id)}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          { color: isSelected ? '#FFF' : colors.text, fontWeight: isSelected ? '700' : '500' },
                        ]}
                      >
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Estimated Labor Cost */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Estimated Labor / Project Cost (NGN)</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="e.g. 120,000"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={costNaira}
                onChangeText={setCostNaira}
              />
            </View>

            {/* Description */}
            <View style={styles.fieldBlock}>
              <Text style={[styles.fieldLabel, { color: colors.text }]}>Materials & Execution Technique</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Describe the physical materials (timber species, cement blend, sealants) and installation technique..."
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Privacy Notice */}
            <View style={styles.privacyNote}>
              <Text style={[styles.privacyNoteText, { color: colors.textSecondary }]}>
                🔒 <Text style={{ fontWeight: '700' }}>In-App Privacy Guaranteed:</Text> Your phone number and email are never shown publicly. Prospective clients initiate conversations via in-app chat.
              </Text>
            </View>

            {/* Submit Button */}
            <Button
              label={submitting ? 'Publishing Craft...' : 'Publish Craft'}
              loading={submitting}
              onPress={handleSubmit}
              disabled={!imageUri || !title.trim() || submitting}
              style={{ marginTop: 8, marginBottom: 40 }}
            />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 14, fontWeight: '600' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  scroll: { paddingTop: 16, paddingBottom: 40 },
  previewContainer: {
    height: 220,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#27272A',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  changeBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  changeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  dropZone: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  dropTitle: { fontSize: 15, fontWeight: '700' },
  dropSub: { fontSize: 12 },
  photoActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  photoBtn: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 },
  photoBtnText: { color: '#FFF', fontWeight: '700', fontSize: 12 },
  fieldBlock: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '700' },
  textInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  textArea: {
    height: 75,
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    fontSize: 14,
  },
  catChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  catChipText: { fontSize: 12 },
  privacyNote: {
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 107, 0, 0.05)',
  },
  privacyNoteText: { fontSize: 11, lineHeight: 16 },
});
