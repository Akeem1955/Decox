import React, { useEffect } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Animated,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();

  const opacity = new Animated.Value(0);
  const scale = new Animated.Value(0.85);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: Platform.OS !== 'web',
      }),
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start(() => {
      setTimeout(onFinish, 1200);
    });
  }, []);

  // Responsive logo sizing: 110px on mobile, scaling up to 180px on desktop/PC
  const logoSize = Math.min(Math.max(Math.min(width, height) * 0.22, 110), 180);

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bg,
          width,
          height: Platform.OS === 'web' ? '100vh' : height,
        } as any,
      ]}
    >
      <Animated.View style={[styles.logoWrap, { opacity, transform: [{ scale }] }]}>
        <Image
          source={require('../../assets/decox-logo.png')}
          style={[styles.logo, { width: logoSize, height: logoSize, borderRadius: logoSize * 0.26 } as any]}
          resizeMode="contain"
        />
      </Animated.View>
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
          minWidth: '100vw',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
        } as any)
      : {}),
  },
  logoWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
});
