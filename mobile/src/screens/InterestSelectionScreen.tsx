import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';

const SPACES = [
  { id: 'living', label: 'Living Room', emoji: '🛋️', uri: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80' },
  { id: 'kitchen', label: 'Kitchen', emoji: '🍳', uri: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&q=80' },
  { id: 'bedroom', label: 'Bedroom', emoji: '🛏️', uri: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400&q=80' },
  { id: 'garden', label: 'Garden & Outdoor', emoji: '🌿', uri: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80' },
  { id: 'office', label: 'Office & Studio', emoji: '🏢', uri: 'https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=400&q=80' },
  { id: 'bathroom', label: 'Bathroom', emoji: '🛁', uri: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400&q=80' },
  { id: 'dining', label: 'Dining Room', emoji: '🍽️', uri: 'https://images.unsplash.com/photo-1722247523645-2a1e1ed6e6f4?w=400&q=80' },
  { id: 'gym', label: 'Gym & Fitness', emoji: '🏋️', uri: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&q=80' },
];

interface InterestSelectionScreenProps {
  onNext: (selected: string[]) => void;
}

export function InterestSelectionScreen({ onNext }: InterestSelectionScreenProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [selected, setSelected] = useState<string[]>([]);

  const contentW = Math.min(width, 600);
  const pad = Math.max(contentW * 0.04, 16);
  const gap = 10;
  const cols = contentW > 480 ? 3 : 2;
  const innerW = contentW - pad * 2;
  const cardW = (innerW - gap * (cols - 1)) / cols;
  const cardH = cardW * 0.82;

  const toggle = (id: string) =>
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ maxWidth: 600, alignSelf: 'center', width: '100%', paddingHorizontal: pad }}>
          <Text style={[styles.headline, { color: colors.text, fontSize: Math.min(contentW * 0.06, 24) }]}>
            What spaces inspire you?
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary, fontSize: Math.min(contentW * 0.032, 13) }]}>
            Choose at least 1. We'll personalize your feed.
          </Text>

          <View style={[styles.grid, { gap }]}>
            {SPACES.map(space => {
              const isSelected = selected.includes(space.id);
              return (
                <TouchableOpacity
                  key={space.id}
                  onPress={() => toggle(space.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.card,
                    { width: cardW, height: cardH, borderRadius: Math.min(cardW * 0.12, 16) },
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <Image source={{ uri: space.uri }} style={styles.cardImg} resizeMode="cover" />
                  <View style={styles.cardOverlay} />
                  {isSelected && (
                    <View style={[styles.checkBadge, { width: 24, height: 24 }]}>
                      <Text style={[styles.check, { fontSize: 13 }]}>✓</Text>
                    </View>
                  )}
                  <Text style={[styles.cardLabel, { fontSize: 12 }]}>
                    {space.emoji} {space.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            label={selected.length === 0 ? 'Select at least 1' : `Continue (${selected.length} selected)`}
            onPress={() => onNext(selected)}
            disabled={selected.length === 0}
            style={{ marginTop: 12, marginBottom: 20 }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 24, gap: 14 },
  headline: { fontWeight: '800', letterSpacing: -0.5 },
  sub: { lineHeight: 20, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  card: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: { borderColor: Colors.accent },
  cardImg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  cardOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  cardLabel: {
    color: '#FFF',
    fontWeight: '700',
    padding: 10,
    textShadowColor: 'rgba(0,0,0,0.7)',
    textShadowRadius: 4,
    textShadowOffset: { width: 0, height: 1 },
  },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 99,
    backgroundColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: { color: '#FFF', fontWeight: '800' },
});
