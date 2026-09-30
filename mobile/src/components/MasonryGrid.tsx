import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  useWindowDimensions,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { FlowerLoader } from './FlowerLoader';

export interface PinItem {
  id: string;
  title: string;
  imageUrl: string;
  heightRatio?: number; // e.g. 1.2, 1.4 for staggered Pinterest masonry
  route?: string;
  isAi?: boolean;
  category?: string;
  stylePref?: string;
  spaceType?: string;
  priceDisplay?: string;
  hasBuyableItems?: boolean;
  itemCount?: number;
  artisanName?: string;
  artisanUid?: string;
  shoppingList?: any[];
  actionCard?: any;
  prompt?: string;
}

interface MasonryGridProps {
  pins: PinItem[];
  onPinPress: (pin: PinItem) => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  isArtisanTab?: boolean;
  onEndReached?: () => void;
  loadingMore?: boolean;
}

export function MasonryGrid({
  pins,
  onPinPress,
  refreshing = false,
  onRefresh,
  isArtisanTab = false,
  onEndReached,
  loadingMore = false,
}: MasonryGridProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const gap = 12;
  const padding = Math.max(width * 0.04, 14);
  const numColumns = width > 768 ? 3 : 2;
  const availableWidth = width - padding * 2;
  const columnWidth = (availableWidth - gap * (numColumns - 1)) / numColumns;

  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: 24 }} />;
    return (
      <View style={styles.loadingMoreFooter}>
        <FlowerLoader size={30} />
        <Text style={[styles.loadingMoreText, { color: colors.textSecondary }]}>
          Loading more craftwork...
        </Text>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyCard}>
      <Text style={{ fontSize: 44, marginBottom: 12 }}>{isArtisanTab ? '🔨' : '🛋️'}</Text>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>
        {isArtisanTab ? 'No Artisan Work Yet' : 'No AI Redesigns Yet'}
      </Text>
      <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
        {isArtisanTab
          ? 'Be the first artisan to submit verified physical craftwork using the "+ Submit Craft" button.'
          : 'Stage your first room redesign using purchasable instore items.'}
      </Text>
    </View>
  );

  const renderItem = ({ item: pin, index }: { item: PinItem; index: number }) => {
    const ratio = pin.heightRatio || (index % 3 === 0 ? 1.45 : index % 2 === 0 ? 1.25 : 1.1);
    const imgHeight = columnWidth * ratio;

    return (
      <View style={[styles.cellWrapper, { paddingHorizontal: gap / 2 }]}>
        <TouchableOpacity
          style={styles.pinWrapper}
          activeOpacity={0.88}
          onPress={() => onPinPress(pin)}
        >
          {/* Full-bleed rounded image with floating badges */}
          <View style={[styles.imageContainer, { height: imgHeight }]}>
            <Image
              source={{ uri: pin.imageUrl }}
              style={styles.image}
              resizeMode="cover"
            />

            {/* Floating Badge top-left: AI Redesign only for actual AI pins */}
            {pin.isAi ? (
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI Redesign</Text>
              </View>
            ) : null}

            {/* Cart badge top-right for buyable items in AI Redesign */}
            {pin.isAi && (pin.hasBuyableItems || pin.shoppingList?.length) ? (
              <View style={styles.cartBadge}>
                <Text style={styles.cartIcon}>🛒</Text>
              </View>
            ) : null}
          </View>

          {/* Strictly 1 line of text under image (Pinterest style) */}
          {pin.title ? (
            <View style={styles.metaContainer}>
              <Text
                style={[styles.pinTitle, { color: colors.text }]}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {pin.title}
              </Text>
            </View>
          ) : null}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.flexContainer}>
      <FlashList
        data={pins}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        numColumns={numColumns}
        masonry={true}
        optimizeItemArrangement={true}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
        refreshing={refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={[styles.container, { paddingHorizontal: padding - gap / 2 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={renderEmpty}
        ListFooterComponent={renderFooter}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
  },
  container: {
    paddingTop: 10,
    paddingBottom: 90,
  },
  cellWrapper: {
    marginBottom: 12,
  },
  pinWrapper: {
    width: '100%',
  },
  imageContainer: {
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#27272A',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 16,
  },
  aiBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3.5,
    borderRadius: 10,
  },
  aiBadgeText: {
    color: '#FF6B00',
    fontSize: 9.5,
    fontWeight: '700',
  },
  cartBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF6B00',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
  },
  cartIcon: {
    fontSize: 11,
  },
  metaContainer: {
    paddingTop: 5,
    paddingHorizontal: 2,
  },
  pinTitle: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  loadingMoreFooter: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loadingMoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    marginTop: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySub: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
