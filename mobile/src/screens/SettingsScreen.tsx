import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { signOut } from '../services/authService';
import { ProfileScreen } from './ProfileScreen';
import { useSubscription } from '../context/SubscriptionContext';

interface SettingsScreenProps {
  onBack: () => void;
  onLoggedOut?: () => void;
}

export function SettingsScreen({ onBack, onLoggedOut }: SettingsScreenProps) {
  const { colors, preference, setPreference } = useTheme();
  const { width } = useWindowDimensions();
  const { isPro, activePlan, freeGenerationsLeft, openPaywall } = useSubscription();
  const [showProfile, setShowProfile] = useState(false);

  const pad = Math.max(width * 0.05, 16);
  const maxW = Math.min(width, 500);

  const themeOptions: { key: 'system' | 'light' | 'dark'; label: string; desc: string }[] = [
    { key: 'system', label: 'System Default', desc: 'Follows your device setting' },
    { key: 'light', label: 'Light', desc: 'Always light theme' },
    { key: 'dark', label: 'Dark', desc: 'Always dark theme' },
  ];

  const handleLogout = async () => {
    try {
      await signOut();
      if (onLoggedOut) {
        onLoggedOut();
      } else {
        onBack();
      }
    } catch (e: any) {
      Alert.alert('Logout Error', e?.message || 'Could not log out.');
    }
  };

  if (showProfile) {
    return (
      <ProfileScreen
        onBack={() => setShowProfile(false)}
        onOpenSettings={() => setShowProfile(false)}
      />
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}>
        <View style={{ maxWidth: maxW, alignSelf: 'center', width: '100%' }}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onBack} style={styles.back}>
              <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
            <View style={{ width: 30 }} />
          </View>

          {/* Appearance Section */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>APPEARANCE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {themeOptions.map((opt, i) => {
              const isActive = preference === opt.key;
              return (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.row,
                    i < themeOptions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={() => setPreference(opt.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.rowText}>
                    <Text style={[styles.rowLabel, { color: colors.text }]}>{opt.label}</Text>
                    <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>{opt.desc}</Text>
                  </View>
                  <View
                    style={[
                      styles.radio,
                      { borderColor: isActive ? Colors.accent : colors.border },
                    ]}
                  >
                    {isActive && <View style={styles.radioDot} />}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Membership Tier Section */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>DECOX MEMBERSHIP</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => openPaywall()}
              activeOpacity={0.7}
            >
              <View style={styles.rowText}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={[styles.rowLabel, { color: colors.text }]}>
                    {isPro ? 'Decox Pro Active 👑' : 'Decox Free Plan'}
                  </Text>
                  <View
                    style={{
                      backgroundColor: isPro ? '#DCFCE7' : '#FEF3C7',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}
                  >
                    <Text style={{ color: isPro ? '#15803D' : '#92400E', fontSize: 10, fontWeight: '800' }}>
                      {isPro ? (activePlan === 'annual' ? 'ANNUAL' : 'MONTHLY') : `${freeGenerationsLeft} FREE LEFT`}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                  {isPro
                    ? 'Unlimited room redesigns & priority parallel store sourcing.'
                    : 'Tap to unlock unlimited spatial redesigns for ₦3,000/mo.'}
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Account Section */}
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>ACCOUNT & PROFILE</Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              onPress={() => setShowProfile(true)}
              activeOpacity={0.7}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowLabel, { color: colors.text }]}>View & Edit Profile</Text>
                <Text style={[styles.rowDesc, { color: colors.textSecondary }]}>
                  Spaces, preferences, and personal designs
                </Text>
              </View>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.row, { borderBottomWidth: 1, borderBottomColor: colors.border }]}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Notifications', 'Push notifications for artisan replies are enabled.')}
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>Notifications</Text>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.row}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Privacy & Security', 'Firebase Auth token-protected API connection.')}
            >
              <Text style={[styles.rowLabel, { color: colors.text }]}>Account & Security</Text>
              <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
            </TouchableOpacity>
          </View>

          {/* Log Out Button */}
          <TouchableOpacity
            style={[styles.logoutBtn, { borderColor: colors.border }]}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Text style={styles.logoutText}>Log Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingTop: 8, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
  },
  back: { padding: 4 },
  backArrow: { fontSize: 22, fontWeight: '300' },
  title: { fontSize: 18, fontWeight: '700' },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
    marginLeft: 4,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600' },
  rowDesc: { fontSize: 12 },
  chevron: { fontSize: 22, fontWeight: '300' },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.accent,
  },
  logoutBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 8,
  },
  logoutText: { fontSize: 15, fontWeight: '700', color: '#EF4444' },
});
