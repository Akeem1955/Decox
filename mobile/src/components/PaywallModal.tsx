import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { useSubscription } from '../context/SubscriptionContext';
import { FlowerLoader } from './FlowerLoader';

const PRO_BENEFITS = [
  {
    icon: '✨',
    title: 'Unlimited AI Room Redesigns',
    desc: 'Stage endless spaces without hitting the 3-generation quota.',
  },
  {
    icon: '🛒',
    title: 'Priority Parallel Store Scraping',
    desc: 'Concurrent lookups across Jumia, Konga, JiJi, CDCare & Amazon.',
  },
  {
    icon: '🛡️',
    title: 'Direct Artisan Contacts & RFQs',
    desc: 'Instant phone numbers & WhatsApp links to verified master craftsmen.',
  },
  {
    icon: '🔒',
    title: '100% Real or Fail Guarantee',
    desc: 'Compositing physically constrained to real purchasable items.',
  },
];

export function PaywallModal() {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const {
    paywallVisible,
    paywallReason,
    packages,
    closePaywall,
    subscribe,
    restore,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');
  const [processing, setProcessing] = useState(false);

  const pad = Math.max(width * 0.05, 16);
  const maxW = Math.min(width, 540);

  if (!paywallVisible) return null;

  const annualPkg = packages.find(p => p.plan === 'annual');
  const monthlyPkg = packages.find(p => p.plan === 'monthly');

  const annualPrice = annualPkg?.priceDisplay || '₦75,000';
  const monthlyPrice = monthlyPkg?.priceDisplay || '₦3,000';

  const handleSubscribe = async () => {
    setProcessing(true);
    const chosenPkg = selectedPlan === 'annual' ? annualPkg : monthlyPkg;
    const success = await subscribe(selectedPlan, chosenPkg?.rawPackage);
    setProcessing(false);

    if (success) {
      Alert.alert(
        'Decox Pro Unlocked! 👑',
        `You now have full Pro access on the ${selectedPlan === 'annual' ? 'Annual' : 'Monthly'} plan.`
      );
    } else {
      Alert.alert('Notice', 'Subscription could not be processed.');
    }
  };

  const handleRestore = async () => {
    setProcessing(true);
    const restored = await restore();
    setProcessing(false);

    if (restored) {
      Alert.alert('Restored!', 'Your previous Decox Pro subscription has been restored.');
    } else {
      Alert.alert('No Subscription Found', 'No active subscription was found to restore.');
    }
  };

  return (
    <Modal
      visible={paywallVisible}
      animationType="slide"
      transparent
      onRequestClose={closePaywall}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: isDark ? '#18181B' : '#FFFFFF',
              borderColor: colors.border,
              maxWidth: maxW,
            },
          ]}
        >
          {/* Close button */}
          <TouchableOpacity onPress={closePaywall} style={styles.closeBtn}>
            <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>

          <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: pad }]}>
            {/* Crown Header */}
            <View style={styles.headerBlock}>
              <View style={styles.crownWrap}>
                <Text style={{ fontSize: 32 }}>👑</Text>
              </View>
              <Text style={[styles.title, { color: colors.text }]}>Decox Pro</Text>
              <View style={styles.sandboxBadge}>
                <Text style={styles.sandboxBadgeText}>
                  🧪 Sandbox Review Mode • Live Test
                </Text>
              </View>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>
                {paywallReason || 'Upgrade to unlock unlimited authentic room redesigns and priority multi-store sourcing.'}
              </Text>
            </View>

            {/* Feature List */}
            <View
              style={[
                styles.featuresCard,
                {
                  backgroundColor: isDark ? '#27272A' : '#F8FAFC',
                  borderColor: colors.border,
                },
              ]}
            >
              {PRO_BENEFITS.map((item, idx) => (
                <View key={`benefit-${idx}`} style={styles.benefitRow}>
                  <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  <View style={{ flex: 1, gap: 1 }}>
                    <Text style={[styles.benefitTitle, { color: colors.text }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.benefitDesc, { color: colors.textSecondary }]}>
                      {item.desc}
                    </Text>
                  </View>
                </View>
              ))}
            </View>

            {/* Plan Selector */}
            <View style={styles.plansBlock}>
              {/* Monthly Plan (₦3,000) */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                    borderColor: selectedPlan === 'monthly' ? Colors.accent : colors.border,
                  },
                ]}
                onPress={() => setSelectedPlan('monthly')}
                activeOpacity={0.85}
              >
                <View style={styles.radioWrap}>
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: selectedPlan === 'monthly' ? Colors.accent : colors.border },
                    ]}
                  >
                    {selectedPlan === 'monthly' && <View style={styles.radioDot} />}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planTitle, { color: colors.text }]}>Monthly Pro</Text>
                  <Text style={[styles.planDesc, { color: colors.textSecondary }]}>
                    Flexible auto-renew. Cancel anytime.
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.planPrice, { color: Colors.accent }]}>{monthlyPrice}</Text>
                  <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>/month</Text>
                </View>
              </TouchableOpacity>

              {/* Annual Plan (₦75,000) */}
              <TouchableOpacity
                style={[
                  styles.planCard,
                  {
                    backgroundColor: isDark ? '#27272A' : '#FFFFFF',
                    borderColor: selectedPlan === 'annual' ? Colors.accent : colors.border,
                  },
                ]}
                onPress={() => setSelectedPlan('annual')}
                activeOpacity={0.85}
              >
                <View style={styles.radioWrap}>
                  <View
                    style={[
                      styles.radioCircle,
                      { borderColor: selectedPlan === 'annual' ? Colors.accent : colors.border },
                    ]}
                  >
                    {selectedPlan === 'annual' && <View style={styles.radioDot} />}
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.planTitle, { color: colors.text }]}>Annual Pro</Text>
                    <View style={styles.bestValueBadge}>
                      <Text style={styles.bestValueText}>12 Months</Text>
                    </View>
                  </View>
                  <Text style={[styles.planDesc, { color: colors.textSecondary }]}>
                    Full year of unlimited redesigns.
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.planPrice, { color: Colors.accent }]}>{annualPrice}</Text>
                  <Text style={[styles.planPeriod, { color: colors.textSecondary }]}>/year</Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Subscribe Action Button */}
            <TouchableOpacity
              style={[
                styles.subscribeBtn,
                { backgroundColor: Colors.accent, opacity: processing ? 0.7 : 1 },
              ]}
              onPress={handleSubscribe}
              disabled={processing}
              activeOpacity={0.85}
            >
              {processing ? (
                <FlowerLoader size={26} style={{ padding: 0 }} />
              ) : (
                <Text style={styles.subscribeBtnText}>
                  Unlock Decox Pro ({selectedPlan === 'annual' ? annualPrice : monthlyPrice})
                </Text>
              )}
            </TouchableOpacity>

            {/* Restore & Dismiss Footer */}
            <View style={styles.footerRow}>
              <TouchableOpacity onPress={handleRestore} disabled={processing}>
                <Text style={[styles.footerLink, { color: colors.textSecondary }]}>
                  Restore Purchases
                </Text>
              </TouchableOpacity>
              <Text style={{ color: colors.textMuted }}>•</Text>
              <TouchableOpacity onPress={closePaywall} disabled={processing}>
                <Text style={[styles.footerLink, { color: colors.textSecondary }]}>
                  Continue Free
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={[styles.poweredByText, { color: colors.textMuted }]}>
              🛡️ Powered by RevenueCat Sandbox • Apple StoreKit 2 & Google Play Billing
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    alignSelf: 'center',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    maxHeight: '92%',
    paddingBottom: 24,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 18,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { fontSize: 18, fontWeight: '700' },
  content: {
    paddingTop: 24,
    paddingBottom: 20,
    gap: 16,
  },
  headerBlock: {
    alignItems: 'center',
    gap: 6,
  },
  crownWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  sandboxBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  sandboxBadgeText: {
    color: '#92400E',
    fontSize: 11,
    fontWeight: '700',
  },
  sub: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 380,
  },
  featuresCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  benefitDesc: {
    fontSize: 11,
  },
  plansBlock: {
    gap: 10,
  },
  planCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 16,
    borderWidth: 2,
    gap: 12,
  },
  radioWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  planTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  planDesc: {
    fontSize: 11,
  },
  bestValueBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  bestValueText: {
    color: '#15803D',
    fontSize: 9,
    fontWeight: '800',
  },
  planPrice: {
    fontSize: 15,
    fontWeight: '800',
  },
  planPeriod: {
    fontSize: 10,
  },
  subscribeBtn: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  subscribeBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  footerLink: {
    fontSize: 12,
    fontWeight: '600',
  },
  poweredByText: {
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
});
