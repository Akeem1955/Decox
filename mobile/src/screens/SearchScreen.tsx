import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { MasonryGrid, PinItem } from '../components/MasonryGrid';
import { PinDetailScreen } from './PinDetailScreen';
import { searchContent, getArtisanFeed, getAiRedesignsFeed, resolveImageUrl } from '../services/apiClient';
import { FlowerLoader } from '../components/FlowerLoader';

const SEARCH_CATEGORIES = [
  'All',
  'Wall Painting',
  'POP Ceiling',
  'Floor Tiling',
  'Japandi',
  'Contemporary',
  'Interlocking Pavers',
  'Teak Slats',
  'Minimalist',
  'Office Mesh',
  'Living Room',
  'Compound Patio',
];

export function SearchScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPin, setSelectedPin] = useState<PinItem | null>(null);
  const [pins, setPins] = useState<PinItem[]>([]);
  const [loading, setLoading] = useState(true);

  const pad = Math.max(width * 0.04, 14);

  // Fetch initial feed data on mount (browse mode)
  useEffect(() => {
    loadInitialFeed();
  }, []);

  const loadInitialFeed = async () => {
    setLoading(true);
    try {
      const [artisanRes, aiRes] = await Promise.allSettled([
        getArtisanFeed(1, 15),
        getAiRedesignsFeed(1, 15),
      ]);

      const combined: PinItem[] = [];

      if (artisanRes.status === 'fulfilled' && artisanRes.value?.items) {
        for (const item of artisanRes.value.items) {
          combined.push({
            id: item.id,
            title: item.title || 'Artisan Craft',
            imageUrl: resolveImageUrl(item.imageUrl || item.image_url),
            category: item.category,
            isAi: false,
            artisanName: item.artisanName || item.vendor_name,
            artisanUid: item.artisanUid || 'JvLaoDLXBCMYqDO0SyKpeEC6HY42',
          });
        }
      }

      if (aiRes.status === 'fulfilled' && aiRes.value?.designs) {
        for (const d of aiRes.value.designs) {
          combined.push({
            id: d.id,
            title: d.prompt || 'AI Redesign',
            imageUrl: resolveImageUrl(d.mockupImageUrl || d.mockup_image_url),
            category: d.stylePref || d.spaceType,
            isAi: true,
            hasBuyableItems: d.shoppingList && d.shoppingList.length > 0,
            priceDisplay: d.estimatedTotalNaira
              ? `₦${Number(d.estimatedTotalNaira).toLocaleString()} Total`
              : undefined,
            shoppingList: d.shoppingList,
          });
        }
      }

      setPins(combined);
    } catch (err) {
      console.warn('Failed to load initial search feed:', err);
    } finally {
      setLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query, activeCategory);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, activeCategory]);

  const performSearch = async (searchQuery: string, category: string) => {
    // If no query and category is All, show initial feed
    if (!searchQuery.trim() && category === 'All') {
      loadInitialFeed();
      return;
    }

    setLoading(true);
    try {
      const response = await searchContent(searchQuery.trim(), category);
      if (response?.results) {
        const mapped: PinItem[] = response.results.map((r: any) => ({
          id: r.id,
          title: r.title || 'Untitled',
          imageUrl: resolveImageUrl(r.imageUrl || r.image_url),
          category: r.category || r.stylePref,
          isAi: Boolean(r.isAi ?? (r.pinType === 'ai_redesign')),
          artisanName: r.artisanName,
          artisanUid: r.artisanUid || 'JvLaoDLXBCMYqDO0SyKpeEC6HY42',
          hasBuyableItems: r.hasBuyableItems,
          priceDisplay: r.priceDisplay,
          shoppingList: r.shoppingList,
        }));
        setPins(mapped);
      }
    } catch (err) {
      console.warn('Search failed, keeping current results:', err);
    } finally {
      setLoading(false);
    }
  };

  if (selectedPin) {
    return <PinDetailScreen pin={selectedPin} onBack={() => setSelectedPin(null)} />;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Search Header */}
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <View
          style={[
            styles.searchBar,
            {
              backgroundColor: isDark ? '#1F1F23' : '#F1F5F9',
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={{ fontSize: 16 }}>🔍</Text>
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search spaces, artisan trades, furniture..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsScroll}
        >
          {SEARCH_CATEGORIES.map(cat => {
            const isSelected = activeCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor: isSelected ? Colors.accent : isDark ? '#27272A' : '#F1F5F9',
                    borderColor: isSelected ? Colors.accent : colors.border,
                  },
                ]}
                onPress={() => setActiveCategory(cat)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: isSelected ? '#FFF' : colors.text, fontWeight: isSelected ? '700' : '500' },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Results Grid */}
      {loading ? (
        <View style={styles.emptyWrap}>
          <FlowerLoader size={60} />
          <Text style={[styles.emptySub, { color: colors.textSecondary, marginTop: 12 }]}>
            Searching...
          </Text>
        </View>
      ) : pins.length > 0 ? (
        <MasonryGrid
          pins={pins}
          onPinPress={pin => setSelectedPin(pin)}
        />
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={{ fontSize: 36 }}>🔍</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No matching spaces found</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Try searching for "Japandi", "Teak", "Office", or "Paving".
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
    gap: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    height: 46,
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  chipsScroll: {
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 13,
    textAlign: 'center',
  },
});
