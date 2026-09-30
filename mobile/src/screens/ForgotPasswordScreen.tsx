import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useTheme } from '../theme/ThemeContext';
import { resetPassword } from '../services/authService';

interface ForgotPasswordScreenProps {
  onBack: () => void;
  onSent: () => void;
}

export function ForgotPasswordScreen({ onBack, onSent }: ForgotPasswordScreenProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pad = Math.max(width * 0.06, 16);
  const maxW = Math.min(width - pad * 2, 440);

  const handleSend = async () => {
    setError('');
    setLoading(true);
    try {
      await resetPassword(email.trim());
      setSent(true);
      setTimeout(onSent, 2500);
    } catch (e: any) {
      const msg = e?.message || 'Failed to send password reset email';
      if (msg.includes('user-not-found')) {
        setError('No account found with this email.');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, paddingHorizontal: pad }}
      >
        <View style={[styles.inner, { maxWidth: maxW }]}>
          <TouchableOpacity onPress={onBack} style={styles.back}>
            <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
          </TouchableOpacity>

          {!sent ? (
            <>
              <Text style={[styles.headline, { color: colors.text, fontSize: Math.min(width * 0.065, 26) }]}>
                Reset your password
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary, fontSize: Math.min(width * 0.032, 13) }]}>
                Enter the email tied to your account and we'll send a reset link.
              </Text>
              <View style={styles.form}>
                <Input
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoFocus
                />
                {error ? <Text style={styles.errorText}>{error}</Text> : null}
                <Button
                  label={loading ? 'Sending link...' : 'Send Reset Link'}
                  onPress={handleSend}
                  disabled={!email.includes('@') || loading}
                />
              </View>
            </>
          ) : (
            <View style={styles.sentWrap}>
              <Text style={styles.checkmark}>✉️</Text>
              <Text style={[styles.headline, { color: colors.text, textAlign: 'center', fontSize: Math.min(width * 0.065, 26) }]}>
                Check your email
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary, textAlign: 'center', fontSize: Math.min(width * 0.032, 13) }]}>
                We sent a reset link to{'\n'}
                <Text style={{ color: '#FF6B00', fontWeight: '700' }}>{email}</Text>
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  inner: { flex: 1, width: '100%', alignSelf: 'center', paddingTop: 16 },
  back: { marginBottom: 32, alignSelf: 'flex-start', padding: 4 },
  backArrow: { fontSize: 22, fontWeight: '300' },
  headline: { fontWeight: '800', letterSpacing: -0.5, marginBottom: 10 },
  sub: { lineHeight: 20, marginBottom: 28 },
  form: { gap: 14 },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', lineHeight: 18 },
  sentWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  checkmark: { fontSize: 52, marginBottom: 8 },
});
