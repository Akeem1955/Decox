import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { Button } from '../components/Button';

interface CreateUploadScreenProps {
  onImageSelected: (imageUri: string) => void;
  onCancel: () => void;
}

export function CreateUploadScreen({
  onImageSelected,
  onCancel,
}: CreateUploadScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [selectedUri, setSelectedUri] = useState<string | null>(null);

  const pad = Math.max(width * 0.05, 16);
  const maxW = Math.min(width, 560);

  const pickFromGallery = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        setTimeout(() => {
          setSelectedUri(uri);
        }, 50);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Unable to pick photo from gallery.');
    }
  };

  const takePhoto = async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission Denied', 'Camera permission is required to capture room photo.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.8,
        base64: false,
      });

      if (!result.canceled && result.assets && result.assets[0]?.uri) {
        const uri = result.assets[0].uri;
        setTimeout(() => {
          setSelectedUri(uri);
        }, 50);
      }
    } catch (e: any) {
      Alert.alert('Error', 'Unable to capture photo.');
    }
  };

  const handleContinue = () => {
    if (selectedUri) {
      onImageSelected(selectedUri);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}>
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%', gap: 18 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onCancel} style={styles.cancelBtn}>
              <Text style={[styles.cancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>New Redesign Request</Text>
            <View style={{ width: 44 }} />
          </View>

          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Upload a clear photo of your space. Decox will source authentic instore products or master artisans to stage into it.
          </Text>

          {/* Selected Preview or Upload Drop Zone */}
          {selectedUri ? (
            <View key={`preview-${selectedUri}`} style={styles.previewContainer}>
              <Image
                key={`img-${selectedUri}`}
                source={{ uri: selectedUri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.changeBadge}
                onPress={() => setSelectedUri(null)}
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
              <Text style={styles.dropZoneEmoji}>📸</Text>
              <Text style={[styles.dropZoneTitle, { color: colors.text }]}>
                Capture or select room photo
              </Text>
              <Text style={[styles.dropZoneSub, { color: colors.textSecondary }]}>
                Supports JPG, PNG up to 10MB
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: Colors.accent }]}
                  onPress={pickFromGallery}
                  activeOpacity={0.85}
                >
                  <Text style={styles.actionBtnText}>Choose from Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionBtn,
                    {
                      backgroundColor: 'transparent',
                      borderWidth: 1,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={takePhoto}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.actionBtnText, { color: colors.text }]}>Take Photo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Next Button */}
          <Button
            label="Continue to Specifications →"
            onPress={handleContinue}
            disabled={!selectedUri}
            style={{ marginTop: 10, marginBottom: 30 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 10, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  cancelBtn: { padding: 4 },
  cancelText: { fontSize: 14, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 13, lineHeight: 19 },
  previewContainer: {
    height: 280,
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  previewImage: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
  },
  changeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  changeBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  dropZone: {
    padding: 32,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 10,
  },
  dropZoneEmoji: { fontSize: 48, marginBottom: 4 },
  dropZoneTitle: { fontSize: 16, fontWeight: '700' },
  dropZoneSub: { fontSize: 12 },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  actionBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
  },
  actionBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
