import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { SubscriptionProvider } from './src/context/SubscriptionContext';
import { PaywallModal } from './src/components/PaywallModal';
import { AuthNavigator } from './src/navigation/AuthNavigator';

function AppContent() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthNavigator />
      <PaywallModal />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SubscriptionProvider>
          <AppContent />
        </SubscriptionProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
