import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  Linking,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { saveDesign, publishDesign, resolveImageUrl } from '../services/apiClient';
import { ChatDetailScreen } from './ChatDetailScreen';

interface ResultScreenProps {
  originalImage: string;
  resultData: any;
  onDone: () => void;
  onNewEdit: () => void;
}

export function ResultScreen({
  originalImage,
  resultData,
  onDone,
  onNewEdit,
}: ResultScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const [viewMode, setViewMode] = useState<'redesign' | 'original'>('redesign');
  const [isSaved, setIsSaved] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedDesignId, setSavedDesignId] = useState<string | null>(null);
  const [showChatModal, setShowChatModal] = useState(false);

  const pad = Math.max(width * 0.05, 16);
  const maxW = Math.min(width, 680);

  const mockupUrl = resultData?.mockupImageUrl || resultData?.mockupImageData || originalImage;
  const shoppingList = resultData?.shoppingList || [];
  const matchedArtisan = resultData?.matchedArtisan;
  const actionCard = resultData?.actionCard || {};
  const responseText = resultData?.text || '';

  const handleOpenUrl = (url?: string) => {
    if (url && url !== '#') {
      Linking.openURL(url).catch(err => console.error('Could not open URL:', err));
    }
  };

  const handleSave = async () => {
    if (isSaved) return;
    setSaving(true);
    try {
      const res = await saveDesign({
        route: resultData?.route || 'COMMERCE_DIY',
        prompt: resultData?.specs?.title || 'Spatial Redesign',
        originalImageUrl: originalImage,
        mockupImageUrl: mockupUrl,
        shoppingList,
        actionCard,
        spaceType: resultData?.specs?.spaceType || 'HOME_ROOM',
        stylePref: resultData?.specs?.style || 'Contemporary',
        estimatedTotalNaira: resultData?.actionCard?.total_cost_naira || 0,
        matchedArtisan,
        isPublic: false,
      });

      if (res?.design?.id) {
        setSavedDesignId(res.design.id);
      }
      setIsSaved(true);
      Alert.alert('Saved!', 'This redesign is now stored in your Saved designs gallery.');
    } catch (e: any) {
      Alert.alert('Save Failed', e?.message || 'Could not save design.');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    try {
      if (!savedDesignId) {
        // Auto-save first
        const saveRes = await saveDesign({
          route: resultData?.route || 'COMMERCE_DIY',
          prompt: resultData?.specs?.title || 'Spatial Redesign',
          originalImageUrl: originalImage,
          mockupImageUrl: mockupUrl,
          shoppingList,
          actionCard,
          isPublic: true,
        });
        if (saveRes?.design?.id) {
          await publishDesign(saveRes.design.id);
        }
      } else {
        await publishDesign(savedDesignId);
      }
      setIsPublished(true);
      Alert.alert(
        'Published! 🎉',
        'Your redesign is now public on the AI Redesigns tab with 🛒 buy icons for everyone to discover!'
      );
    } catch (e: any) {
      Alert.alert('Publish Failed', e?.message || 'Could not publish design.');
    }
  };

  if (showChatModal && matchedArtisan) {
    const artName = matchedArtisan.vendor_name || 'Adetunji Akeem';
    const artUid = matchedArtisan.vendor_id || 'JvLaoDLXBCMYqDO0SyKpeEC6HY42';
    return (
      <ChatDetailScreen
        artisanUid={artUid}
        artisanName={artName}
        artisanSpecialty={matchedArtisan.title || matchedArtisan.category || 'Specialist'}
        pinContext={{
          title: resultData?.specs?.title || 'Staged Concept',
          imageUrl: resultData?.mockupImageUrl || resultData?.originalImageUrl,
        }}
        initialDraft={`Hi ${artName}, I staged a concept for my space with ${resultData?.specs?.title || 'your finish'}. Are you available for a site estimate?`}
        onBack={() => setShowChatModal(false)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Top Header */}
      <View style={[styles.header, { paddingHorizontal: pad, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={onDone} style={styles.closeBtn}>
          <Text style={[styles.closeIcon, { color: colors.text }]}>✕</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Staged Room Concept</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}>
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%', gap: 18 }}>
          {/* Before / After Toggle Bar */}
          <View
            style={[
              styles.toggleBar,
              { backgroundColor: isDark ? '#27272A' : '#F1F5F9', borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'redesign' && [styles.toggleBtnActive, { backgroundColor: Colors.accent }],
              ]}
              onPress={() => setViewMode('redesign')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: viewMode === 'redesign' ? '#FFF' : colors.textSecondary },
                ]}
              >
                Redesigned Space (AI Staged)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.toggleBtn,
                viewMode === 'original' && [
                  styles.toggleBtnActive,
                  { backgroundColor: isDark ? '#3F3F46' : '#E2E8F0' },
                ],
              ]}
              onPress={() => setViewMode('original')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.toggleText,
                  { color: viewMode === 'original' ? colors.text : colors.textSecondary },
                ]}
              >
                📷 Original Photo
              </Text>
            </TouchableOpacity>
          </View>

          {/* Staged Visual Card */}
          <View style={styles.imageCard}>
            <Image
              source={{ uri: viewMode === 'redesign' ? resolveImageUrl(mockupUrl) : originalImage }}
              style={[styles.mainImage, { height: Math.min(width * 1.05, 460) }]}
              resizeMode="cover"
            />
            {viewMode === 'redesign' && (
              <View style={styles.realGuaranteeBadge}>
                <Text style={styles.realGuaranteeText}>
                  🛡️ 100% Real Sourced Instore Items
                </Text>
              </View>
            )}
          </View>

          {/* Action Row: Save + Publish */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[
                styles.actionPill,
                {
                  backgroundColor: isSaved ? '#DCFCE7' : Colors.accent,
                  borderColor: isSaved ? '#22C55E' : Colors.accent,
                },
              ]}
              onPress={handleSave}
              disabled={saving || isSaved}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.actionPillText,
                  { color: isSaved ? '#166534' : '#FFFFFF' },
                ]}
              >
                {isSaved ? '✓ Saved to Designs' : '📌 Save Design'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionPill,
                {
                  backgroundColor: isPublished ? '#EDE9FE' : isDark ? '#27272A' : '#F1F5F9',
                  borderColor: isPublished ? '#8B5CF6' : colors.border,
                },
              ]}
              onPress={handlePublish}
              disabled={isPublished}
              activeOpacity={0.85}
            >
              <Text
                style={[
                  styles.actionPillText,
                  { color: isPublished ? '#5B21B6' : colors.text },
                ]}
              >
                {isPublished ? '✓ Public on Feed' : '🌍 Publish to Public Feed'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* AI Spatial Assessment Text */}
          {responseText ? (
            <View
              style={[
                styles.summaryCard,
                { backgroundColor: isDark ? '#1C1C1E' : '#F8FAFC', borderColor: colors.border },
              ]}
            >
              <Text style={[styles.summaryTitle, { color: colors.text }]}>Spatial Specification</Text>
              <Text style={[styles.summaryBody, { color: colors.textSecondary }]}>
                {responseText.replace(/###/g, '').replace(/\*\*/g, '')}
              </Text>
            </View>
          ) : null}

          {/* Shopping Cart List (Real or Fail) */}
          {shoppingList.length > 0 && (
            <View style={styles.shoppingBlock}>
              <View style={styles.shoppingBlockHeader}>
                <Text style={[styles.shoppingTitle, { color: colors.text }]}>
                  🛒 Live Sourced Shopping List ({shoppingList.length})
                </Text>
                <Text style={[styles.shoppingSub, { color: colors.textSecondary }]}>
                  Authentic products staged directly from Nigerian marketplaces.
                </Text>
              </View>

              <View style={styles.itemList}>
                {shoppingList.map((item: any, idx: number) => {
                  const priceDisp =
                    item.price_display ||
                    (item.price_naira ? `₦${item.price_naira.toLocaleString()}` : 'Unknown');

                  return (
                    <View
                      key={`shop-item-${idx}`}
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
                          <Text style={{ fontSize: 22 }}>📦</Text>
                        </View>
                      )}

                      <View style={styles.itemInfo}>
                        <Text style={[styles.itemName, { color: colors.text }]} numberOfLines={2}>
                          {item.item_name || 'Marketplace Item'}
                        </Text>
                        <Text style={styles.itemPrice}>{priceDisp}</Text>
                        {item.store_name ? (
                          <Text style={[styles.itemStore, { color: colors.textSecondary }]}>
                            {item.store_name}
                          </Text>
                        ) : null}
                      </View>

                      {item.buy_url && (
                        <TouchableOpacity
                          style={styles.buyBtn}
                          onPress={() => handleOpenUrl(item.buy_url)}
                          activeOpacity={0.8}
                        >
                          <Text style={styles.buyBtnText}>Buy Online ↗</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Matched Artisan Contact Card */}
          {matchedArtisan && (
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
                    {matchedArtisan.vendor_name || 'Master Craftsman'}
                  </Text>
                  <Text style={{ color: isDark ? '#86EFAC' : '#15803D', fontSize: 12 }}>
                    ⭐ {matchedArtisan.vendor_rating || 5.0} • Verified Physical Trade
                  </Text>
                </View>
              </View>

              <Text style={[styles.artisanBio, { color: isDark ? '#CBD5E1' : '#334155' }]}>
                {matchedArtisan.description || 'Specialist in custom civil & spatial finishes.'}
              </Text>

              <TouchableOpacity
                style={styles.chatBtn}
                onPress={() => setShowChatModal(true)}
                activeOpacity={0.85}
              >
                <Text style={styles.chatBtnText}>
                  💬 Message {matchedArtisan.vendor_name || 'Artisan'} in App
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Bottom Actions */}
          <TouchableOpacity
            style={[styles.newEditBtn, { borderColor: colors.border }]}
            onPress={onNewEdit}
            activeOpacity={0.8}
          >
            <Text style={[styles.newEditText, { color: colors.text }]}>🔄 Create Another Edit</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  closeBtn: { padding: 4 },
  closeIcon: { fontSize: 20, fontWeight: '700' },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  scroll: { paddingTop: 14, paddingBottom: 60 },
  toggleBar: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  toggleBtnActive: {
    elevation: 2,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '700',
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
  realGuaranteeBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(24, 24, 27, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  realGuaranteeText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionPill: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  summaryCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  summaryTitle: { fontSize: 15, fontWeight: '800' },
  summaryBody: { fontSize: 13, lineHeight: 18 },
  shoppingBlock: { gap: 12 },
  shoppingBlockHeader: { gap: 2 },
  shoppingTitle: { fontSize: 17, fontWeight: '800' },
  shoppingSub: { fontSize: 12 },
  itemList: { gap: 10 },
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
  itemInfo: { flex: 1, gap: 2 },
  itemName: { fontSize: 13, fontWeight: '700', lineHeight: 17 },
  itemPrice: { fontSize: 13, fontWeight: '800', color: Colors.accent },
  itemStore: { fontSize: 11 },
  buyBtn: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  buyBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  artisanCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  artisanHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  artisanAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artisanName: { fontSize: 16, fontWeight: '800' },
  artisanBio: { fontSize: 13, lineHeight: 18 },
  chatBtn: {
    backgroundColor: '#16A34A',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  chatBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  newEditBtn: {
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    marginTop: 8,
  },
  newEditText: { fontSize: 14, fontWeight: '700' },
});
