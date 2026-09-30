import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  StyleProp,
  ViewStyle,
  ImageStyle,
  Animated,
  Platform,
  Easing,
} from 'react-native';

interface FlowerLoaderProps {
  size?: number;
  animated?: boolean;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
}

/**
 * Brand-consistent Animated Flower Loading Indicator.
 * Displays Decox's signature flower icon with smooth breathing pulse & gentle sway.
 */
export function FlowerLoader({
  size = 56,
  animated = true,
  style,
  imageStyle,
}: FlowerLoaderProps) {
  const borderRadius = Math.round(size * 0.22);
  const animValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) return;

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(animValue, {
          toValue: 1,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
        Animated.timing(animValue, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: Platform.OS !== 'web',
        }),
      ])
    );

    loop.start();
    return () => loop.stop();
  }, [animated, animValue]);

  const scale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.88, 1.12],
  });

  const rotate = animValue.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-5deg', '0deg', '5deg'],
  });

  const opacity = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <View style={[styles.container, style]}>
      <Animated.View
        style={[
          styles.shadow,
          animated && {
            transform: [{ scale }, { rotate }],
            opacity,
          },
        ]}
      >
        <Image
          source={require('../../assets/decox-logo.png')}
          style={[
            {
              width: size,
              height: size,
              borderRadius,
            },
            imageStyle,
          ]}
          resizeMode="contain"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
  },
  shadow: {
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
