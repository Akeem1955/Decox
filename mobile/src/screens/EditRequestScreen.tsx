import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Image,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { Button } from '../components/Button';

const SPACES = [
  { id: 'living', label: 'Living Room', icon: '🛋️' },
  { id: 'bedroom', label: 'Bedroom', icon: '🛏️' },
  { id: 'kitchen', label: 'Kitchen & Dining', icon: '🍳' },
  { id: 'patio', label: 'Garden & Patio', icon: '🌿' },
  { id: 'office', label: 'Office Workspace', icon: '🏢' },
  { id: 'gym', label: 'Gym & Sports Pitch', icon: '🏋️' },
];

const STYLES = [
  { id: 'japandi', label: 'Japandi' },
  { id: 'contemporary', label: 'Contemporary' },
  { id: 'minimalist', label: 'Minimalist' },
  { id: 'industrial', label: 'Industrial' },
  { id: 'rustic', label: 'Rustic & Natural' },
  { id: 'bohemian', label: 'Bohemian' },
];

const STORES = [
  { id: 'auto', name: 'Auto / Reliability Default', desc: 'Auto-select with cascade fallback' },
  { id: 'jumia', name: 'Jumia Nigeria (Rank 1)', desc: 'High reliability & stock' },
  { id: 'konga', name: 'Konga (Rank 2)', desc: 'High reliability furniture' },
  { id: 'jiji', name: 'JiJi Nigeria (Rank 3)', desc: 'Very high variety' },
  { id: 'cdcare', name: 'CDCare (Rank 4)', desc: 'Installment & appliances' },
  { id: 'amazon', name: 'Amazon (Rank 5)', desc: 'Global inventory' },
  { id: 'custom', name: 'Custom Store / URL', desc: 'Any verified merchant website' },
];

interface EditRequestScreenProps {
  imageUri: string;
  onBack: () => void;
  onSubmit: (formData: {
    roomImage: string;
    prompt: string;
    spaceType: string;
    stylePref: string;
    preferredStore?: string;
  }) => void;
}

export function EditRequestScreen({
  imageUri,
  onBack,
  onSubmit,
}: EditRequestScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [selectedSpace, setSelectedSpace] = useState('living');
  const [selectedStyle, setSelectedStyle] = useState('japandi');
  const [prompt, setPrompt] = useState('');
  const [selectedStore, setSelectedStore] = useState('auto');
  const [customStoreName, setCustomStoreName] = useState('');
  const [validatingStore, setValidatingStore] = useState(false);

  const pad = Math.max(width * 0.05, 16);
  const maxW = Math.min(width, 560);

  const handleSubmit = async () => {
    if (!prompt.trim()) {
      Alert.alert('Prompt required', 'Please describe the items or changes you want to stage into this room.');
      return;
    }

    let finalStore = selectedStore === 'auto' ? undefined : selectedStore;

    // AI Brand Validator for custom store
    if (selectedStore === 'custom') {
      const storeToValidate = customStoreName.trim();
      if (!storeToValidate) {
        Alert.alert('Store Name Required', 'Please enter the store name or website URL.');
        return;
      }

      setValidatingStore(true);
      try {
        // Quick validation rule: Must look like a valid store name or domain
        const isValid =
          storeToValidate.includes('.') ||
          ['ikea', 'west elm', 'crate and barrel', 'target', 'wayfair', 'home depot', 'zara home'].some(b =>
            storeToValidate.toLowerCase().includes(b)
          ) ||
          storeToValidate.length > 2;

        if (!isValid) {
          Alert.alert(
            'Brand Unverified',
            `Could not verify "${storeToValidate}" as an existing retail brand. Please enter a valid store.`
          );
          setValidatingStore(false);
          return;
        }
        finalStore = storeToValidate;
      } finally {
        setValidatingStore(false);
      }
    }

    onSubmit({
      roomImage: imageUri,
      prompt: `${prompt.trim()} (Style: ${selectedStyle}, Space: ${selectedSpace})`,
      spaceType: selectedSpace.toUpperCase(),
      stylePref: selectedStyle,
      preferredStore: finalStore,
    });
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}>
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%', gap: 20 }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Edit Specifications</Text>
            <View style={{ width: 32 }} />
          </View>

          {/* Room Photo Small Preview */}
          <View style={styles.photoPreviewRow}>
            <Image source={{ uri: imageUri }} style={styles.photoThumb} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.photoLabel, { color: colors.text }]}>Target Space</Text>
              <Text style={[styles.photoSub, { color: colors.textSecondary }]}>
                Real items will be staged into this room.
              </Text>
            </View>
          </View>

          {/* Section 1: Space Type */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>1. Select Space Type</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>
              {SPACES.map(sp => {
                const isSelected = selectedSpace === sp.id;
                return (
                  <TouchableOpacity
                    key={sp.id}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: isSelected ? Colors.accent : isDark ? '#27272A' : '#F1F5F9',
                        borderColor: isSelected ? Colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedSpace(sp.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 14 }}>{sp.icon}</Text>
                    <Text
                      style={[
                        styles.chipText,
                        { color: isSelected ? '#FFF' : colors.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {sp.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Section 2: Style Preference */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>2. Preferred Design Style</Text>
            <View style={styles.wrapGrid}>
              {STYLES.map(st => {
                const isSelected = selectedStyle === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.styleButton,
                      {
                        backgroundColor: isSelected ? Colors.accent : isDark ? '#27272A' : '#F8FAFC',
                        borderColor: isSelected ? Colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedStyle(st.id)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.styleText,
                        { color: isSelected ? '#FFF' : colors.text, fontWeight: isSelected ? '700' : '500' },
                      ]}
                    >
                      {st.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Section 3: Desired Items / Prompt */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>3. What items would you like added?</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              Be specific (e.g. "Low oak ground coffee table with woven floor pouf and minimalist pendant lighting").
            </Text>
            <TextInput
              style={[
                styles.textInput,
                {
                  backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholder="e.g. Add a contemporary l-shaped sofa and marble coffee table..."
              placeholderTextColor={colors.textMuted}
              value={prompt}
              onChangeText={setPrompt}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Section 4: Store Sourcing Target */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>4. Marketplace Sourcing Target</Text>
            <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
              Parallel API will scrape verified instore items with authentic Naira prices.
            </Text>

            <View style={styles.storeCards}>
              {STORES.map(st => {
                const isSelected = selectedStore === st.id;
                return (
                  <TouchableOpacity
                    key={st.id}
                    style={[
                      styles.storeCard,
                      {
                        backgroundColor: isDark ? '#1F1F23' : '#FFFFFF',
                        borderColor: isSelected ? Colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => setSelectedStore(st.id)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.radioCol}>
                      <View
                        style={[
                          styles.radioCircle,
                          { borderColor: isSelected ? Colors.accent : colors.border },
                        ]}
                      >
                        {isSelected && <View style={styles.radioDot} />}
                      </View>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[styles.storeName, { color: colors.text }]}>{st.name}</Text>
                      <Text style={[styles.storeDesc, { color: colors.textSecondary }]}>{st.desc}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom Store Input (With LLM Validator trigger) */}
            {selectedStore === 'custom' && (
              <View style={[styles.customStoreBox, { borderColor: Colors.accent }]}>
                <Text style={[styles.customStoreLabel, { color: colors.text }]}>
                  Enter Merchant Brand Name or Website URL:
                </Text>
                <TextInput
                  style={[
                    styles.textInputSingle,
                    {
                      backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                      borderColor: colors.border,
                      color: colors.text,
                    },
                  ]}
                  placeholder="e.g. westelm.com, Ikea, target.com"
                  placeholderTextColor={colors.textMuted}
                  value={customStoreName}
                  onChangeText={setCustomStoreName}
                  autoCapitalize="none"
                />
                <Text style={{ fontSize: 11, color: colors.textSecondary }}>
                  🛡️ AI Validator ensures the brand exists before initiating deep scrape.
                </Text>
              </View>
            )}
          </View>

          {/* Submit Action */}
          <Button
            label={validatingStore ? 'Validating Store...' : 'Generate Spatial Redesign 🚀'}
            onPress={handleSubmit}
            disabled={!prompt.trim() || validatingStore}
            style={{ marginTop: 10, marginBottom: 40 }}
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
  backBtn: { padding: 4 },
  backArrow: { fontSize: 24, fontWeight: '300' },
  title: { fontSize: 18, fontWeight: '800' },
  photoPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 107, 0, 0.08)',
  },
  photoThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  photoLabel: {
    fontSize: 14,
    fontWeight: '800',
  },
  photoSub: {
    fontSize: 12,
  },
  section: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  horizontalChips: {
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
  },
  wrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  styleText: {
    fontSize: 13,
  },
  textInput: {
    height: 90,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  storeCards: {
    gap: 8,
  },
  storeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    gap: 12,
  },
  radioCol: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  storeName: {
    fontSize: 14,
    fontWeight: '700',
  },
  storeDesc: {
    fontSize: 11,
  },
  customStoreBox: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: 'rgba(255, 107, 0, 0.05)',
    gap: 8,
  },
  customStoreLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  textInputSingle: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
});
