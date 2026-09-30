import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { HomeFeedScreen } from '../screens/HomeFeedScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { CreateFlowScreen } from '../screens/CreateFlowScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { SavedScreen } from '../screens/SavedScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AddPortfolioModal } from '../components/AddPortfolioModal';

type Tab = 'home' | 'search' | 'create' | 'inbox' | 'saved';

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '🏠' },
  { key: 'search', label: 'Search', icon: '🔍' },
  { key: 'create', label: '', icon: '➕' },
  { key: 'inbox', label: 'Inbox', icon: '💬' },
  { key: 'saved', label: 'Saved', icon: '📌' },
];

interface MainTabNavigatorProps {
  onLogout?: () => void;
}

export function MainTabNavigator({ onLogout }: MainTabNavigatorProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [showSettings, setShowSettings] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showArtisanModal, setShowArtisanModal] = useState(false);

  // Settings overlay — slides over from Saved tab gear icon
  if (showSettings) {
    return (
      <SettingsScreen
        onBack={() => setShowSettings(false)}
        onLoggedOut={() => {
          setShowSettings(false);
          if (onLogout) onLogout();
        }}
      />
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'home':
        return <HomeFeedScreen />;
      case 'search':
        return <SearchScreen />;
      case 'create':
        return <CreateFlowScreen onFinish={() => setActiveTab('home')} />;
      case 'inbox':
        return <InboxScreen onExplore={() => setActiveTab('home')} />;
      case 'saved':
        return <SavedScreen onOpenSettings={() => setShowSettings(true)} />;
    }
  };

  const handleCenterPlusPress = () => {
    setShowChoiceModal(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {/* Screen content */}
      <View style={styles.content}>{renderContent()}</View>

      {/* Bottom tab bar (Pinterest-style 5 tabs) */}
      <View
        style={[
          styles.tabBar,
          {
            backgroundColor: isDark ? '#111111' : '#FFFFFF',
            borderTopColor: isDark ? '#1E1E1E' : '#F0EFED',
            paddingBottom: Math.max(insets.bottom, 14),
          },
        ]}
      >
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          const isCreate = tab.key === 'create';

          if (isCreate) {
            return (
              <TouchableOpacity
                key={tab.key}
                style={styles.tabItem}
                onPress={handleCenterPlusPress}
                activeOpacity={0.85}
              >
                <View style={styles.createBtn}>
                  <Text style={styles.createIcon}>+</Text>
                </View>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabIcon, { opacity: isActive ? 1 : 0.5 }]}>{tab.icon}</Text>
              <Text
                style={[
                  styles.tabLabel,
                  {
                    color: isActive ? colors.text : colors.textMuted,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {tab.label}
              </Text>
              {isActive && <View style={styles.activeDot} />}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Create Choice Action Sheet Modal */}
      <Modal
        visible={showChoiceModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowChoiceModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowChoiceModal(false)}
        >
          <View
            style={[
              styles.choiceSheet,
              {
                backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
                borderColor: colors.border,
                maxWidth: Math.min(width, 480),
                paddingBottom: Math.max(insets.bottom + 16, 34),
              },
            ]}
          >
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>What would you like to create?</Text>
              <TouchableOpacity onPress={() => setShowChoiceModal(false)} style={styles.sheetClose}>
                <Text style={{ fontSize: 16, color: colors.textSecondary }}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.choiceOptions}>
              {/* Option 1: AI Room Redesign */}
              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  {
                    backgroundColor: isDark ? '#27272A' : '#F8FAFC',
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => {
                  setShowChoiceModal(false);
                  setActiveTab('create');
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceIconWrap, { backgroundColor: 'rgba(255, 107, 0, 0.12)' }]}>
                  <Text style={{ fontSize: 26 }}>🛋️</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[styles.choiceCardTitle, { color: colors.text }]}>
                    Request AI Room Redesign
                  </Text>
                  <Text style={[styles.choiceCardSub, { color: colors.textSecondary }]}>
                    Stage authentic purchasable furniture & materials into your space.
                  </Text>
                </View>
                <View style={[styles.arrowPill, { backgroundColor: '#FF6B00' }]}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </TouchableOpacity>

              {/* Option 2: Upload Artisan Craft */}
              <TouchableOpacity
                style={[
                  styles.choiceCard,
                  {
                    backgroundColor: isDark ? '#27272A' : '#F8FAFC',
                    borderColor: '#FF6B00',
                    borderWidth: 2,
                  },
                ]}
                onPress={() => {
                  setShowChoiceModal(false);
                  setShowArtisanModal(true);
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceIconWrap, { backgroundColor: 'rgba(255, 107, 0, 0.16)' }]}>
                  <Text style={{ fontSize: 26 }}>🔨</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.choiceCardTitle, { color: colors.text }]}>
                      Upload Artisan Craft Work
                    </Text>
                    <View style={styles.artisanBadge}>
                      <Text style={styles.artisanBadgeText}>ARTISAN</Text>
                    </View>
                  </View>
                  <Text style={[styles.choiceCardSub, { color: colors.textSecondary }]}>
                    Publish verified woodwork, tiling, pavers or masonry directly to the craft feed.
                  </Text>
                </View>
                <View style={[styles.arrowPill, { backgroundColor: '#FF6B00' }]}>
                  <Text style={styles.arrowText}>→</Text>
                </View>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Artisan Upload Modal */}
      <AddPortfolioModal
        visible={showArtisanModal}
        onClose={() => setShowArtisanModal(false)}
        onSuccess={() => {
          setShowArtisanModal(false);
          setActiveTab('home');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  tabIcon: { fontSize: 22 },
  tabLabel: { fontSize: 10, marginTop: 1 },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 3,
  },
  createBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 6,
  },
  createIcon: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '300',
    lineHeight: 28,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  choiceSheet: {
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    padding: 22,
    paddingBottom: 34,
    gap: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  sheetClose: {
    padding: 4,
  },
  choiceOptions: {
    gap: 12,
  },
  choiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
  },
  choiceIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceCardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  choiceCardSub: {
    fontSize: 11,
    lineHeight: 15,
  },
  artisanBadge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  artisanBadgeText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '800',
  },
  arrowPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
