import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import { FlowerLoader } from './FlowerLoader';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'google';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors, isDark } = useTheme();

  const getContainerStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return { backgroundColor: Colors.accent };
      case 'secondary':
        return {
          backgroundColor: isDark ? colors.surfaceAlt : colors.surfaceAlt,
          borderWidth: 1,
          borderColor: colors.border,
        };
      case 'ghost':
        return { backgroundColor: 'transparent' };
      case 'google':
        return {
          backgroundColor: isDark ? colors.surfaceAlt : '#FFFFFF',
          borderWidth: 1,
          borderColor: isDark ? colors.border : '#E0E0E0',
        };
      default:
        return { backgroundColor: Colors.accent };
    }
  };

  const getLabelColor = (): string => {
    switch (variant) {
      case 'primary':
        return '#FFFFFF';
      case 'secondary':
      case 'google':
        return colors.text;
      case 'ghost':
        return Colors.accent;
      default:
        return '#FFFFFF';
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.base,
        getContainerStyle(),
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <FlowerLoader size={26} style={{ padding: 0 }} />
      ) : (
        <Text style={[styles.label, { color: getLabelColor() }, textStyle]}>
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  disabled: {
    opacity: 0.45,
  },
});
