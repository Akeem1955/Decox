import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { getCurrentUser } from '../services/authService';
import { getProfile, getMyDesigns, resolveImageUrl } from '../services/apiClient';
import { MasonryGrid, PinItem } from '../components/MasonryGrid';

interface ProfileScreenProps {
  onBack: () => void;
  onOpenSettings: () => void;
}

export function ProfileScreen({ onBack, onOpenSettings }: ProfileScreenProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  const user = getCurrentUser();
  const [profileData, setProfileData] = useState<any>(null);
  const [myDesigns, setMyDesigns] = useState<PinItem[]>([]);

  const pad = Math.max(width * 0.05, 16);

  useEffect(() => {
    getProfile()
      .then(res => setProfileData(res.user))
      .catch(() => {});

    getMyDesigns()
      .then(res => {
        if (res?.designs) {
          const mapped: PinItem[] = res.designs.map((d: any) => ({
            id: d.id,
            title: d.prompt || 'My Spatial Redesign',
            imageUrl: resolveImageUrl(d.mockupImageUrl || d.originalImageUrl),
            isAi: true,
            hasBuyableItems: true,
            priceDisplay: d.estimatedTotalNaira ? `₦${d.estimatedTotalNaira.toLocaleString()}` : 'Buyable items',
          }));
          setMyDesigns(mapped);
        }
      })
      .catch(() => {});
  }, []);

  const displayName = profileData?.name || user?.displayName || 'Decox Explorer';
  const email = profileData?.email || user?.email || '';
  const interests: string[] = profileData?.interests || ['Living Room', 'Garden & Patio'];
  const stylesList: string[] = profileData?.styles || ['Japandi', 'Contemporary'];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]} edges={['top']}>
      {/* Header */}
      <View style={[styles.header, { paddingHorizontal: pad }]}>
        <TouchableOpacity onPress={onBack} style={styles.iconBtn}>
          <Text style={[styles.iconText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Profile</Text>
        <TouchableOpacity onPress={onOpenSettings} style={styles.iconBtn}>
          <Text style={styles.iconText}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}>
        {/* User Card */}
        <View style={styles.userCard}>
          <View style={styles.avatarWrap}>
            <Text style={{ fontSize: 36 }}>👤</Text>
          </View>
          <Text style={[styles.userName, { color: colors.text }]}>{displayName}</Text>
          <Text style={[styles.userEmail, { color: colors.textSecondary }]}>{email}</Text>

          {/* Preferences Badges */}
          <View style={styles.preferencesRow}>
            {interests.map(item => (
              <View
                key={item}
                style={[styles.prefBadge, { backgroundColor: isDark ? '#27272A' : '#F1F5F9' }]}
              >
                <Text style={[styles.prefText, { color: colors.text }]}>📍 {item}</Text>
              </View>
            ))}
            {stylesList.map(item => (
              <View
                key={item}
                style={[styles.prefBadge, { backgroundColor: 'rgba(255, 107, 0, 0.1)' }]}
              >
                <Text style={{ color: Colors.accent, fontSize: 11, fontWeight: '700' }}>
                  🎨 {item}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Section: My Created Designs */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            My Created Redesigns ({myDesigns.length})
          </Text>
          <Text style={[styles.sectionSub, { color: colors.textSecondary }]}>
            Authentic spaces staged using your edit requests.
          </Text>
        </View>

        {myDesigns.length > 0 ? (
          <MasonryGrid pins={myDesigns} onPinPress={() => {}} />
        ) : (
          <View style={[styles.emptyBox, { borderColor: colors.border }]}>
            <Text style={{ fontSize: 32 }}>🛋️</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No redesigns created yet</Text>
            <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
              Tap the center ➕ button to stage your room with authentic buyable items.
            </Text>
          </View>
        )}
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
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconText: { fontSize: 20 },
  headerTitle: { fontSize: 17, fontWeight: '800' },
  scroll: { paddingTop: 16, paddingBottom: 60, gap: 20 },
  userCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  avatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  userName: { fontSize: 20, fontWeight: '800' },
  userEmail: { fontSize: 13 },
  preferencesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    justifyContent: 'center',
    marginTop: 8,
  },
  prefBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  prefText: { fontSize: 11, fontWeight: '600' },
  sectionHeader: { gap: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  sectionSub: { fontSize: 12 },
  emptyBox: {
    alignItems: 'center',
    padding: 28,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: 8,
    marginTop: 8,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700' },
  emptySub: { fontSize: 12, textAlign: 'center', lineHeight: 17 },
});
