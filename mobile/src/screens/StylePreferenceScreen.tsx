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

const STYLES = [
  { id: 'japandi', label: 'Japandi', uri: 'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?w=400&q=80' },
  { id: 'contemporary', label: 'Contemporary', uri: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400&q=80' },
  { id: 'minimalist', label: 'Minimalist', uri: 'https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?w=400&q=80' },
  { id: 'maximalist', label: 'Maximalist', uri: 'https://images.unsplash.com/photo-1615873968403-89e068629265?w=400&q=80' },
  { id: 'rustic', label: 'Rustic & Natural', uri: 'https://images.unsplash.com/photo-1780170008509-d2dee1c7479d?w=400&q=80' },
  { id: 'industrial', label: 'Industrial', uri: 'https://images.unsplash.com/photo-1639432327656-6a03a0ffbea2?w=400&q=80' },
  { id: 'bohemian', label: 'Bohemian', uri: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=400&q=80' },
  { id: 'coastal', label: 'Coastal', uri: 'https://images.unsplash.com/photo-1613545325278-f24b0cae1224?w=400&q=80' },
];

interface StylePreferenceScreenProps {
  onNext: (selected: string[]) => void;
  onBack: () => void;
}

export function StylePreferenceScreen({ onNext, onBack }: StylePreferenceScreenProps) {
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
          <TouchableOpacity onPress={onBack} style={styles.back}>
            <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
          </TouchableOpacity>

          <Text style={[styles.headline, { color: colors.text, fontSize: Math.min(contentW * 0.06, 24) }]}>
            Pick your style
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary, fontSize: Math.min(contentW * 0.032, 13) }]}>
            Your feed and AI redesigns will reflect your taste.
          </Text>

          <View style={[styles.grid, { gap }]}>
            {STYLES.map(style => {
              const isSelected = selected.includes(style.id);
              return (
                <TouchableOpacity
                  key={style.id}
                  onPress={() => toggle(style.id)}
                  activeOpacity={0.85}
                  style={[
                    styles.card,
                    { width: cardW, height: cardH, borderRadius: Math.min(cardW * 0.12, 16) },
                    isSelected && styles.cardSelected,
                  ]}
                >
                  <Image source={{ uri: style.uri }} style={styles.cardImg} resizeMode="cover" />
                  <View style={styles.cardOverlay} />
                  {isSelected && (
                    <View style={[styles.checkBadge, { width: 24, height: 24 }]}>
                      <Text style={[styles.check, { fontSize: 13 }]}>✓</Text>
                    </View>
                  )}
                  <Text style={[styles.cardLabel, { fontSize: 12 }]}>
                    {style.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Button
            label={selected.length === 0 ? 'Select at least 1' : 'Explore Decox →'}
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
  scroll: { paddingTop: 16, gap: 14 },
  back: { alignSelf: 'flex-start', padding: 4, marginBottom: 12 },
  backArrow: { fontSize: 22, fontWeight: '300' },
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
    backgroundColor: 'rgba(0,0,0,0.3)',
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
