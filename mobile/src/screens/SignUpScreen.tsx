import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useTheme } from '../theme/ThemeContext';
import { signUpWithEmail } from '../services/authService';
import { registerUser } from '../services/apiClient';

type Step = 'email' | 'password' | 'name';

interface SignUpScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

export function SignUpScreen({ onComplete, onBack }: SignUpScreenProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const STEP_INDEX = { email: 0, password: 1, name: 2 };
  const progress = (STEP_INDEX[step] + 1) / 3;

  const pad = Math.max(width * 0.06, 16);
  const maxW = Math.min(width - pad * 2, 440);

  const headline = {
    email: "What's your email?",
    password: 'Create a password',
    name: "What's your name?",
  }[step];

  const sub = {
    email: 'We use this to save your designs and connect with artisans.',
    password: 'At least 8 characters. Use a mix for stronger security.',
    name: "This is how you'll appear on Decox.",
  }[step];

  const handleNext = async () => {
    setError('');
    if (step === 'email') {
      setStep('password');
    } else if (step === 'password') {
      setStep('name');
    } else {
      // Final step: create Firebase account + register with backend
      setLoading(true);
      try {
        await signUpWithEmail(email, password, name);
        await registerUser({ name }).catch(() => {});
        onComplete();
      } catch (e: any) {
        const msg = e?.message || 'Sign up failed';
        if (msg.includes('email-already-in-use')) {
          setError('This email is already registered. Try logging in.');
        } else if (msg.includes('weak-password')) {
          setError('Password is too weak. Use at least 6 characters.');
        } else {
          setError(msg);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (step === 'email') onBack();
    else if (step === 'password') setStep('email');
    else setStep('password');
  };

  const canContinue =
    (step === 'email' && email.includes('@')) ||
    (step === 'password' && password.length >= 8) ||
    (step === 'name' && name.trim().length >= 2);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={[styles.header, { maxWidth: maxW, alignSelf: 'center', width: '100%' }]}>
            <TouchableOpacity onPress={handleBack} style={styles.back}>
              <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
            </TouchableOpacity>
            <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
              <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
            </View>
          </View>

          {/* Content */}
          <View style={[styles.body, { maxWidth: maxW, alignSelf: 'center', width: '100%' }]}>
            <Text style={[styles.headline, { color: colors.text, fontSize: Math.min(width * 0.065, 26) }]}>
              {headline}
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary, fontSize: Math.min(width * 0.032, 13) }]}>
              {sub}
            </Text>

            {step === 'email' && (
              <Input
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoFocus
              />
            )}
            {step === 'password' && (
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoFocus
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
                    <Text style={{ color: '#FF6B00', fontSize: 12, fontWeight: '700' }}>
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                }
              />
            )}
            {step === 'name' && (
              <Input
                placeholder="Your name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                autoFocus
              />
            )}

            {error ? (
              <Text style={[styles.errorText, { color: '#EF4444' }]}>{error}</Text>
            ) : null}

            <Button
              label={loading ? 'Creating Account...' : step === 'name' ? 'Create Account' : 'Continue'}
              onPress={handleNext}
              disabled={!canContinue || loading}
              style={{ marginTop: 8 }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 40 },
  back: { padding: 4 },
  backArrow: { fontSize: 22, fontWeight: '300' },
  progressTrack: { flex: 1, height: 3, borderRadius: 99 },
  progressFill: { height: 3, borderRadius: 99, backgroundColor: '#FF6B00' },
  body: { gap: 16 },
  headline: { fontWeight: '800', letterSpacing: -0.5, lineHeight: 32 },
  sub: { lineHeight: 20, marginBottom: 8 },
  errorText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
});
