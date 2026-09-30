import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export type MainTab = 'home' | 'search' | 'create' | 'inbox' | 'saved';

const items: { key: MainTab; label: string; icon: string }[] = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'search', label: 'Search', icon: '⌕' },
  { key: 'create', label: 'Create', icon: '+' },
  { key: 'inbox', label: 'Inbox', icon: '◌' },
  { key: 'saved', label: 'Saved', icon: '♡' },
];

export function BottomNav({ active, onChange }: { active: MainTab; onChange: (tab: MainTab) => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map(item => {
        const selected = item.key === active;
        const isCreate = item.key === 'create';
        return (
          <TouchableOpacity key={item.key} accessibilityRole="button" accessibilityLabel={item.label}
            onPress={() => onChange(item.key)} style={styles.item} activeOpacity={0.75}>
            <View style={isCreate ? [styles.createIcon, { borderColor: colors.bg }] : undefined}>
              <Text style={[styles.icon, isCreate && styles.createIconText, { color: selected || isCreate ? '#FFFFFF' : colors.textMuted }]}>{item.icon}</Text>
            </View>
            <Text style={[styles.label, { color: selected ? '#FF6B00' : colors.textMuted }]}>{item.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { height: 76, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3 },
  icon: { fontSize: 23, lineHeight: 25, fontWeight: '500' },
  label: { fontSize: 10, fontWeight: '700' },
  createIcon: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', marginTop: -20, borderWidth: 4, borderColor: '#0E0E0E' },
  createIconText: { fontSize: 28, lineHeight: 30, fontWeight: '300' },
});
