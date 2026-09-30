import React, { useState, useEffect, useRef } from 'react';
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
import { getAiRedesignsFeed, getArtisanFeed, resolveImageUrl } from '../services/apiClient';
import { AddPortfolioModal } from '../components/AddPortfolioModal';
import { FlowerLoader } from '../components/FlowerLoader';

type HomeSubTab = 'artisan' | 'ai';

export function HomeFeedScreen() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [activeTab, setActiveTab] = useState<HomeSubTab>('artisan');
  const [artisanPins, setArtisanPins] = useState<PinItem[]>([]);
  const [aiPins, setAiPins] = useState<PinItem[]>([]);
  const [selectedPin, setSelectedPin] = useState<PinItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Pagination states
  const [artisanPage, setArtisanPage] = useState(1);
  const [aiPage, setAiPage] = useState(1);
  const [artisanHasMore, setArtisanHasMore] = useState(true);
  const [aiHasMore, setAiHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadingMoreRef = useRef(false);

  const pad = Math.max(width * 0.04, 14);

  const fetchFeedData = async (targetTab: HomeSubTab = activeTab, isRefresh = false) => {
    if (!isRefresh) {
      setLoading(true);
    }
    try {
      if (targetTab === 'artisan') {
        setArtisanPage(1);
        setArtisanHasMore(true);
        const res = await getArtisanFeed(1, 20).catch(() => null);
        if (res?.items && res.items.length > 0) {
          const mapped: PinItem[] = res.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            imageUrl: resolveImageUrl(item.imageUrl),
            category: item.category,
            artisanName: item.artisanName,
            artisanUid: item.artisanUid || 'JvLaoDLXBCMYqDO0SyKpeEC6HY42',
            isAi: false,
            prompt: item.description,
          }));
          setArtisanPins(mapped);
          if (res.items.length < 20) {
            setArtisanHasMore(false);
          }
        } else {
          setArtisanPins([]);
          setArtisanHasMore(false);
        }
      } else {
        setAiPage(1);
        setAiHasMore(true);
        const res = await getAiRedesignsFeed(1, 20).catch(() => null);
        if (res?.designs && res.designs.length > 0) {
          const mapped: PinItem[] = res.designs.map((d: any) => ({
            id: d.id,
            title: d.prompt || 'Spatial AI Redesign',
            imageUrl: resolveImageUrl(d.mockupImageUrl || d.originalImageUrl),
            category: d.spaceType,
            stylePref: d.stylePref,
            isAi: true,
            hasBuyableItems: true,
            shoppingList: d.shoppingList || [],
            prompt: d.prompt,
            priceDisplay: d.estimatedTotalNaira ? `₦${d.estimatedTotalNaira.toLocaleString()}` : 'Buyable items',
          }));
          setAiPins(mapped);
          if (res.designs.length < 20) {
            setAiHasMore(false);
          }
        } else {
          setAiPins([]);
          setAiHasMore(false);
        }
      }
    } catch (err) {
      console.warn('Feed fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (loading || loadingMore || loadingMoreRef.current) return;

    if (activeTab === 'artisan') {
      if (!artisanHasMore) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const nextPage = artisanPage + 1;
      try {
        const res = await getArtisanFeed(nextPage, 20).catch(() => null);
        if (res?.items && res.items.length > 0) {
          const mapped: PinItem[] = res.items.map((item: any) => ({
            id: item.id,
            title: item.title,
            imageUrl: resolveImageUrl(item.imageUrl),
            category: item.category,
            artisanName: item.artisanName,
            artisanUid: item.artisanUid || 'JvLaoDLXBCMYqDO0SyKpeEC6HY42',
            isAi: false,
            prompt: item.description,
          }));
          setArtisanPins(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = mapped.filter(p => !existingIds.has(p.id));
            return [...prev, ...newItems];
          });
          setArtisanPage(nextPage);
          if (res.items.length < 20) {
            setArtisanHasMore(false);
          }
        } else {
          setArtisanHasMore(false);
        }
      } catch (err) {
        console.warn('Load more artisan error:', err);
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    } else {
      if (!aiHasMore) return;
      loadingMoreRef.current = true;
      setLoadingMore(true);
      const nextPage = aiPage + 1;
      try {
        const res = await getAiRedesignsFeed(nextPage, 20).catch(() => null);
        if (res?.designs && res.designs.length > 0) {
          const mapped: PinItem[] = res.designs.map((d: any) => ({
            id: d.id,
            title: d.prompt || 'Spatial AI Redesign',
            imageUrl: resolveImageUrl(d.mockupImageUrl || d.originalImageUrl),
            category: d.spaceType,
            stylePref: d.stylePref,
            isAi: true,
            hasBuyableItems: true,
            shoppingList: d.shoppingList || [],
            prompt: d.prompt,
            priceDisplay: d.estimatedTotalNaira ? `₦${d.estimatedTotalNaira.toLocaleString()}` : 'Buyable items',
          }));
          setAiPins(prev => {
            const existingIds = new Set(prev.map(p => p.id));
            const newItems = mapped.filter(p => !existingIds.has(p.id));
            return [...prev, ...newItems];
          });
          setAiPage(nextPage);
          if (res.designs.length < 20) {
            setAiHasMore(false);
          }
        } else {
          setAiHasMore(false);
        }
      } catch (err) {
        console.warn('Load more AI error:', err);
      } finally {
        loadingMoreRef.current = false;
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    fetchFeedData(activeTab);
  }, [activeTab]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFeedData(activeTab, true);
    setRefreshing(false);
  };

  // If viewing pin detail
  if (selectedPin) {
    return (
      <PinDetailScreen
        pin={selectedPin}
        onBack={() => setSelectedPin(null)}
      />
    );
  }

  const currentPins = activeTab === 'artisan' ? artisanPins : aiPins;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Home Header with Top Sub-Tabs */}
      <View style={[styles.headerContainer, { paddingHorizontal: pad }]}>
        {/* Dual Sub-Tabs (Artisan vs Platform AI Redesign) */}
        <View
          style={[
            styles.subTabBar,
            {
              backgroundColor: isDark ? '#27272A' : '#F1F5F9',
              borderColor: colors.border,
            },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.subTabButton,
              activeTab === 'artisan' && [
                styles.subTabButtonActive,
                { backgroundColor: isDark ? '#18181B' : '#FFFFFF' },
              ],
            ]}
            onPress={() => setActiveTab('artisan')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.subTabText,
                {
                  color: activeTab === 'artisan' ? (isDark ? '#34D399' : '#059669') : colors.textSecondary,
                  fontWeight: activeTab === 'artisan' ? '700' : '500',
                },
              ]}
            >
              Artisan Craft
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subTabButton,
              activeTab === 'ai' && [
                styles.subTabButtonActive,
                { backgroundColor: isDark ? '#18181B' : '#FFFFFF' },
              ],
            ]}
            onPress={() => setActiveTab('ai')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.subTabText,
                {
                  color: activeTab === 'ai' ? Colors.accent : colors.textSecondary,
                  fontWeight: activeTab === 'ai' ? '700' : '500',
                },
              ]}
            >
              AI Redesigns 🛒
            </Text>
          </TouchableOpacity>
        </View>

        {/* Sub-header row with Submit Craft button */}
        {activeTab === 'artisan' && (
          <View style={styles.subHeaderRow}>
            <View style={{ flex: 1 }} />
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={() => setShowAddModal(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.submitBtnText}>+ Submit Craft</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Masonry Pin Feed */}
      {loading ? (
        <View style={styles.centerLoader}>
          <FlowerLoader size={64} />
        </View>
      ) : (
        <MasonryGrid
          pins={currentPins}
          onPinPress={pin => setSelectedPin(pin)}
          refreshing={refreshing}
          onRefresh={onRefresh}
          isArtisanTab={activeTab === 'artisan'}
          onEndReached={handleLoadMore}
          loadingMore={loadingMore}
        />
      )}

      {/* Add Artisan Portfolio Modal with Anti-AI Pre-Verification */}
      <AddPortfolioModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={newItem => {
          if (newItem) {
            setArtisanPins(prev => [
              {
                id: newItem.id || `craft-${Date.now()}`,
                title: newItem.title,
                imageUrl: newItem.imageUrl,
                category: newItem.category,
                isAi: false,
                prompt: newItem.description,
              },
              ...prev,
            ]);
          }
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerContainer: {
    paddingTop: 8,
    paddingBottom: 8,
    gap: 10,
  },
  subHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 2,
  },
  submitBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  subTabBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 24,
    borderWidth: 1,
  },
  subTabButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  subTabButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  subTabText: {
    fontSize: 13,
  },
  centerLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
