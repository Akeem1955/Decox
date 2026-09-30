import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { MasonryGrid, PinItem } from '../components/MasonryGrid';
import { PinDetailScreen } from './PinDetailScreen';
import { getMyDesigns, resolveImageUrl } from '../services/apiClient';

interface SavedScreenProps {
  onOpenSettings: () => void;
}

export function SavedScreen({ onOpenSettings }: SavedScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [savedPins, setSavedPins] = useState<PinItem[]>([]);
  const [selectedPin, setSelectedPin] = useState<PinItem | null>(null);

  const pad = Math.max(width * 0.05, 16);

  useEffect(() => {
    // Try fetching user's saved designs from backend
    getMyDesigns()
      .then(res => {
        if (res?.designs && res.designs.length > 0) {
          const mapped: PinItem[] = res.designs.map((d: any) => ({
            id: d.id,
            title: d.prompt || 'Spatial Redesign',
            imageUrl: resolveImageUrl(d.mockupImageUrl || d.originalImageUrl),
            isAi: d.route === 'COMMERCE_DIY',
            hasBuyableItems: true,
            shoppingList: d.shoppingList || [],
            priceDisplay: d.estimatedTotalNaira ? `₦${d.estimatedTotalNaira.toLocaleString()}` : 'Buyable items',
          }));
          setSavedPins(mapped);
        }
      })
      .catch(() => {
        // API unavailable — empty state will display
      });
  }, []);

  if (selectedPin) {
    return (
      <PinDetailScreen
        pin={selectedPin}
        isSaved={true}
        onBack={() => setSelectedPin(null)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header with gear icon top-right (Pinterest pattern) */}
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <View>
          <Text style={[styles.title, { color: colors.text, fontSize: Math.min(width * 0.065, 24) }]}>
            Saved Designs
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary }]}>
            {savedPins.length} bookmarked spaces & artisan works
          </Text>
        </View>

        <TouchableOpacity onPress={onOpenSettings} style={styles.gearBtn} activeOpacity={0.7}>
          <Text style={[styles.gearIcon]}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* Flat gallery of saved designs (no boards/collections) */}
      {savedPins.length > 0 ? (
        <MasonryGrid
          pins={savedPins}
          onPinPress={pin => setSelectedPin(pin)}
        />
      ) : (
        <View style={styles.empty}>
          <Text style={[styles.emptyIcon]}>📌</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No saved designs yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Save authentic AI redesigns and artisan work from the home feed or your created edits to access them here.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  title: { fontWeight: '800', letterSpacing: -0.3 },
  sub: { fontSize: 12, marginTop: 2 },
  gearBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 22 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 4 },
  emptyTitle: { fontSize: 18, fontWeight: '700' },
  emptySub: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});
