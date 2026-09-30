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
import { loginWithEmail } from '../services/authService';

interface LoginScreenProps {
  onLogin: () => void;
  onBack: () => void;
  onForgotPassword: () => void;
}

export function LoginScreen({ onLogin, onBack, onForgotPassword }: LoginScreenProps) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const pad = Math.max(width * 0.06, 16);
  const maxW = Math.min(width - pad * 2, 440);
  const canLogin = email.includes('@') && password.length >= 6;

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithEmail(email, password);
      onLogin();
    } catch (e: any) {
      const msg = e?.message || 'Login failed';
      if (msg.includes('user-not-found') || msg.includes('invalid-credential')) {
        setError('Invalid email or password.');
      } else if (msg.includes('wrong-password')) {
        setError('Incorrect password.');
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
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingHorizontal: pad }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.inner, { maxWidth: maxW }]}>
            <TouchableOpacity onPress={onBack} style={styles.back}>
              <Text style={[styles.backArrow, { color: colors.text }]}>←</Text>
            </TouchableOpacity>

            <Text style={[styles.headline, { color: colors.text, fontSize: Math.min(width * 0.07, 28) }]}>
              Welcome back
            </Text>
            <Text style={[styles.sub, { color: colors.textSecondary, fontSize: Math.min(width * 0.032, 13) }]}>
              Log in to your Decox account.
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
              <Input
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                rightIcon={
                  <TouchableOpacity onPress={() => setShowPassword(p => !p)}>
                    <Text style={{ color: '#FF6B00', fontSize: 12, fontWeight: '700' }}>
                      {showPassword ? 'HIDE' : 'SHOW'}
                    </Text>
                  </TouchableOpacity>
                }
              />
              <TouchableOpacity onPress={onForgotPassword} style={styles.forgotRow}>
                <Text style={[styles.forgotText, { color: '#FF6B00' }]}>Forgot password?</Text>
              </TouchableOpacity>
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <Button label={loading ? 'Logging in...' : 'Log In'} onPress={handleLogin} disabled={!canLogin || loading} />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, paddingTop: 16 },
  inner: { width: '100%', alignSelf: 'center' },
  back: { marginBottom: 32, alignSelf: 'flex-start', padding: 4 },
  backArrow: { fontSize: 22, fontWeight: '300' },
  headline: { fontWeight: '800', letterSpacing: -0.5, marginBottom: 8 },
  sub: { marginBottom: 28 },
  form: { gap: 14 },
  forgotRow: { alignSelf: 'flex-end' },
  forgotText: { fontSize: 13, fontWeight: '600' },
  errorText: { fontSize: 13, color: '#EF4444', textAlign: 'center', lineHeight: 18 },
});
