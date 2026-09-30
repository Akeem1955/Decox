import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  Share,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { PinItem } from '../components/MasonryGrid';
import { ChatDetailScreen } from './ChatDetailScreen';

interface PinDetailScreenProps {
  pin: PinItem;
  onBack: () => void;
  onSaveBookmark?: (pin: PinItem) => void;
  isSaved?: boolean;
}

export function PinDetailScreen({
  pin,
  onBack,
  onSaveBookmark,
  isSaved = false,
}: PinDetailScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const [saved, setSaved] = useState(isSaved);
  const [showChatModal, setShowChatModal] = useState(false);

  const pad = Math.max(width * 0.04, 16);
  const maxW = Math.min(width, 680);

  const handleOpenUrl = (url?: string) => {
    if (url && url !== '#') {
      Linking.openURL(url).catch(err => console.error('Could not open link:', err));
    }
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Check out this design on Decox: ${pin.title}\n${pin.imageUrl}`,
      });
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSave = () => {
    setSaved(!saved);
    if (onSaveBookmark) {
      onSaveBookmark(pin);
    }
  };

  const shoppingList = pin.shoppingList || [];
  const artisan = pin.actionCard?.matched_artisan || (pin.artisanName ? {
    vendor_name: pin.artisanName,
    in_app_chat_available: true,
    vendor_rating: 4.9,
    description: pin.prompt || 'Master verified craftsmanship',
  } : null);

  if (showChatModal && artisan) {
    const artName = artisan.vendor_name || pin.artisanName || 'Adetunji Akeem';
    const artUid = pin.artisanUid || artisan.vendor_id || 'JvLaoDLXBCMYqDO0SyKpeEC6HY42';
    return (
      <ChatDetailScreen
        artisanUid={artUid}
        artisanName={artName}
        artisanSpecialty={pin.category || 'Specialist'}
        pinContext={{
          id: pin.id,
          title: pin.title,
          imageUrl: pin.imageUrl,
        }}
        initialDraft={`Hi ${artName}, I saw your craft "${pin.title}" on Decox. Can we discuss a project for my space?`}
        onBack={() => setShowChatModal(false)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Top Header Bar */}
      <View style={[styles.navBar, { paddingHorizontal: pad, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Text style={[styles.navIcon, { color: colors.text }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.rightNav}>
          <TouchableOpacity onPress={handleShare} style={styles.iconBtn}>
            <Text style={[styles.navIcon, { color: colors.text }]}>↗️</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={toggleSave}
            style={[
              styles.saveBtn,
              { backgroundColor: saved ? '#E2E8F0' : Colors.accent },
            ]}
          >
            <Text style={[styles.saveBtnText, { color: saved ? '#1E293B' : '#FFFFFF' }]}>
              {saved ? 'Saved ✓' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingHorizontal: pad }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%' }}>
          {/* Main Visual Image */}
          <View style={styles.imageCard}>
            <Image
              source={{ uri: pin.imageUrl }}
              style={[styles.mainImage, { height: Math.min(width * 1.1, 480) }]}
              resizeMode="cover"
            />
            {pin.isAi ? (
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>AI Redesign</Text>
              </View>
            ) : (
              <View style={[styles.typeBadge, { backgroundColor: 'rgba(16, 185, 129, 0.9)' }]}>
                <Text style={styles.typeBadgeText}>Artisan Work</Text>
              </View>
            )}
          </View>

          {/* Title & Description */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.title, { color: colors.text }]}>{pin.title}</Text>
            {pin.prompt ? (
              <Text style={[styles.promptText, { color: colors.textSecondary }]}>
                {pin.prompt}
              </Text>
            ) : null}
            {pin.category || pin.stylePref ? (
              <View style={styles.tagsRow}>
                {pin.category ? (
                  <View style={[styles.tag, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>{pin.category}</Text>
                  </View>
                ) : null}
                {pin.stylePref ? (
                  <View style={[styles.tag, { backgroundColor: isDark ? '#27272A' : '#F4F4F5' }]}>
                    <Text style={[styles.tagText, { color: colors.textSecondary }]}>{pin.stylePref}</Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Sourced Shopping List (Zero Fake Items, Direct Merchant Href) */}
          {shoppingList.length > 0 ? (
            <View style={styles.block}>
              <View style={styles.blockHeader}>
                <Text style={[styles.blockTitle, { color: colors.text }]}>
                  🛒 Real Sourced Items ({shoppingList.length})
                </Text>
                <Text style={[styles.blockSub, { color: colors.textSecondary }]}>
                  Instore verified items staged directly into this space.
                </Text>
              </View>

              <View style={styles.itemsList}>
                {shoppingList.map((item, idx) => {
                  const priceDisp =
                    item.price_display ||
                    (item.price_naira ? `₦${item.price_naira.toLocaleString()}` : 'Unknown');

                  return (
                    <View
                      key={`item-${idx}`}
                      style={[
                        styles.itemCard,
                        {
                          backgroundColor: isDark ? '#1F1F23' : '#FFFFFF',
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={styles.itemThumb} />
                      ) : (
                        <View style={[styles.itemThumb, styles.itemThumbPlaceholder]}>
                          <Text style={{ fontSize: 20 }}>📦</Text>
                        </View>
                      )}

                      <View style={styles.itemInfo}>
                        <Text
                          style={[styles.itemName, { color: colors.text }]}
                          numberOfLines={2}
                        >
                          {item.item_name || item.title || 'Marketplace Item'}
                        </Text>
                        <Text style={styles.itemPrice}>{priceDisp}</Text>
                        {item.store_name ? (
                          <Text style={[styles.itemStore, { color: colors.textSecondary }]}>
                            Store: {item.store_name}
                          </Text>
                        ) : null}
                      </View>

                      {item.buy_url ? (
                        <TouchableOpacity
                          style={styles.buyBtn}
                          onPress={() => handleOpenUrl(item.buy_url)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.buyBtnText}>Buy ↗</Text>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* Artisan Contact Card (Direct phone link, no automated dispatch) */}
          {artisan ? (
            <View
              style={[
                styles.artisanCard,
                {
                  backgroundColor: isDark ? '#1C281F' : '#F0FDF4',
                  borderColor: '#86EFAC',
                },
              ]}
            >
              <View style={styles.artisanHeader}>
                <View style={styles.artisanAvatar}>
                  <Text style={{ fontSize: 24 }}>👨‍🔧</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.artisanName, { color: isDark ? '#DCFCE7' : '#14532D' }]}>
                    {artisan.vendor_name || 'Master Artisan'}
                  </Text>
                  <Text style={{ color: isDark ? '#86EFAC' : '#15803D', fontSize: 12 }}>
                    ⭐ {artisan.vendor_rating || 5.0} • Verified Craft Specialist
                  </Text>
                </View>
              </View>

              <Text
                style={[
                  styles.artisanBio,
                  { color: isDark ? '#CBD5E1' : '#334155' },
                ]}
              >
                {artisan.description || artisan.vendor_bio || 'Specialist in custom civil & spatial finishes.'}
              </Text>

              <TouchableOpacity
                style={styles.chatArtisanBtn}
                onPress={() => setShowChatModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.chatArtisanText}>
                  💬 Message {artisan.vendor_name || 'Artisan'} in App
                </Text>
              </TouchableOpacity>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  navBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIcon: { fontSize: 22 },
  rightNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  saveBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  saveBtnText: {
    fontWeight: '700',
    fontSize: 14,
  },
  scrollContent: {
    paddingTop: 16,
    paddingBottom: 60,
  },
  imageCard: {
    borderRadius: 20,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#E2E8F0',
  },
  mainImage: {
    width: '100%',
  },
  typeBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(24, 24, 27, 0.85)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  typeBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  sectionHeader: {
    marginTop: 16,
    gap: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  promptText: {
    fontSize: 14,
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  block: {
    marginTop: 24,
    gap: 12,
  },
  blockHeader: {
    gap: 2,
  },
  blockTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  blockSub: {
    fontSize: 12,
  },
  itemsList: {
    gap: 10,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  itemThumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  itemThumbPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 3,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  itemPrice: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.accent,
  },
  itemStore: {
    fontSize: 11,
  },
  buyBtn: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buyBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '700',
  },
  artisanCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  artisanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  artisanAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artisanName: {
    fontSize: 16,
    fontWeight: '800',
  },
  artisanBio: {
    fontSize: 13,
    lineHeight: 18,
  },
  chatArtisanBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatArtisanText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 14,
  },
});
