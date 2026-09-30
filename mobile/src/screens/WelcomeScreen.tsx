import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  useWindowDimensions,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button } from '../components/Button';
import { useTheme } from '../theme/ThemeContext';
import { signInWithGoogle } from '../services/authService';
import { registerUser } from '../services/apiClient';

// Pinterest-style collage: 3-column staggered
const COLLAGE_COLS = [
  [
    { uri: 'https://images.unsplash.com/photo-1618219908412-a29a1bb7b86e?w=400&q=80', ratio: 1.25 },
    { uri: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400&q=80', ratio: 1.0 },
    { uri: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400&q=80', ratio: 1.2 },
  ],
  [
    { uri: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&q=80', ratio: 1.35 },
    { uri: 'https://images.unsplash.com/photo-1540518614846-7eded433c457?w=400&q=80', ratio: 1.1 },
    { uri: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&q=80', ratio: 1.25 },
  ],
  [
    { uri: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=400&q=80', ratio: 1.2 },
    { uri: 'https://images.unsplash.com/photo-1616047006789-b7af5afb8c20?w=400&q=80', ratio: 1.35 },
    { uri: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?w=400&q=80', ratio: 1.1 },
  ],
];

interface WelcomeScreenProps {
  onContinue: () => void;
  onLogin: () => void;
  onGoogleSuccess: (hasCompletedOnboarding: boolean) => void;
}

export function WelcomeScreen({ onContinue, onLogin, onGoogleSuccess }: WelcomeScreenProps) {
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const user = await signInWithGoogle();
      
      // Fast path: if this browser/app session already finished onboarding, bypass questionnaire
      const localOnboarded = typeof window !== 'undefined' && window.localStorage?.getItem('decox_onboarded') === 'true';
      if (localOnboarded) {
        registerUser({ name: user.displayName || 'Decox Explorer' }).catch(() => null);
        onGoogleSuccess(true);
        return;
      }

      const res = await registerUser({ name: user.displayName || 'Decox Explorer' }).catch(() => null);
      const userRecord = res?.user;
      const hasCompleted = Boolean(
        userRecord &&
        Array.isArray(userRecord.interests) &&
        userRecord.interests.length > 0 &&
        Array.isArray(userRecord.styles) &&
        userRecord.styles.length > 0
      );
      if (hasCompleted && typeof window !== 'undefined') {
        window.localStorage?.setItem('decox_onboarded', 'true');
      }
      onGoogleSuccess(hasCompleted);
    } catch (e: any) {
      if (!e?.message?.includes('popup-closed-by-user')) {
        Alert.alert('Sign-In Error', e?.message || 'Google sign-in failed');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  const isDesktop = width >= 600;
  const containerW = Math.min(width, 440);
  const padH = Math.max(containerW * 0.05, 18);
  const gap = 8;
  const tileW = (containerW - padH * 2 - gap * 2) / 3;
  const logoSize = Math.min(Math.max(containerW * 0.14, 52), 60);

  const effectiveHeight = isDesktop ? Math.min(height, 860) : height;
  const collageH = Math.round(effectiveHeight * 0.50);
  const headlineSize = Math.min(containerW * 0.065, 26);
  const subSize = Math.min(containerW * 0.033, 13);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.canvas,
          {
            maxWidth: 440,
            height: isDesktop ? Math.min(height, 860) : '100%',
          },
        ]}
      >
        {/* Collage */}
        <View style={[styles.collage, { height: collageH, paddingHorizontal: padH }]} pointerEvents="none">
          {COLLAGE_COLS.map((col, colIdx) => (
            <View key={colIdx} style={[styles.col, { width: tileW }]}>
              {col.map((img, imgIdx) => (
                <Image
                  key={imgIdx}
                  source={{ uri: img.uri }}
                  style={[styles.tile, { height: tileW * img.ratio }]}
                  resizeMode="cover"
                />
              ))}
            </View>
          ))}
          {/* Smooth bottom fade into dynamic background */}
          <LinearGradient
            colors={isDark ? ['transparent', 'rgba(14,14,14,0.6)', colors.bg] : ['transparent', 'rgba(250,248,245,0.7)', colors.bg]}
            style={styles.gradient}
            pointerEvents="none"
          />
        </View>

        {/* Bottom sheet */}
        <SafeAreaView style={[styles.sheet, { backgroundColor: colors.bg, paddingHorizontal: padH * 1.5 }]} edges={['bottom']}>
          <Image
            source={require('../../assets/decox-logo.png')}
            style={[styles.logo, { width: logoSize, height: logoSize, borderRadius: Math.round(logoSize * 0.25) }]}
            resizeMode="contain"
          />

          <Text style={[styles.headline, { color: colors.text, fontSize: headlineSize, lineHeight: Math.round(headlineSize * 1.22) }]}>
            Design your space,{'\n'}your way.
          </Text>
          <Text style={[styles.sub, { color: colors.textSecondary, fontSize: subSize }]}>
            Discover AI-redesigned interiors & artisan craft.
          </Text>

          <View style={styles.actions}>
            <Button label="Continue with Email" onPress={onContinue} variant="primary" />
            <View style={styles.dividerRow}>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
              <Text style={[styles.or, { color: colors.textMuted }]}>or</Text>
              <View style={[styles.line, { backgroundColor: colors.border }]} />
            </View>
            <Button
              label="Continue with Google"
              onPress={handleGoogleSignIn}
              variant="google"
              loading={googleLoading}
            />
          </View>

          <TouchableOpacity onPress={onLogin} style={styles.loginRow}>
            <Text style={[styles.loginText, { color: colors.textSecondary }]}>
              Already have an account?{' '}
              <Text style={{ color: '#FF6B00', fontWeight: '700' }}>Log in</Text>
            </Text>
          </TouchableOpacity>

          <Text style={[styles.legal, { color: colors.textMuted }]}>
            By continuing you agree to our Terms & Privacy Policy.
          </Text>
        </SafeAreaView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({
          minHeight: '100vh',
          width: '100%',
        } as any)
      : {}),
  },
  canvas: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  collage: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 36,
    overflow: 'hidden',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  col: { gap: 8 },
  tile: { width: '100%', borderRadius: 14 },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 18,
    paddingBottom: Platform.OS === 'web' ? 24 : 12,
    gap: 10,
    alignItems: 'center',
  },
  logo: { marginBottom: 2 },
  headline: {
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  sub: {
    textAlign: 'center',
    marginBottom: 2,
  },
  actions: { width: '100%', maxWidth: 380, gap: 10, alignSelf: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: 1 },
  or: { fontSize: 12, fontWeight: '600' },
  loginRow: { marginTop: 2 },
  loginText: { fontSize: 13, textAlign: 'center' },
  legal: { fontSize: 10, textAlign: 'center', paddingBottom: 4 },
});
