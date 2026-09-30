import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  rightIcon?: React.ReactNode;
  containerStyle?: ViewStyle;
}

export function Input({
  label,
  error,
  rightIcon,
  containerStyle,
  ...props
}: InputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={[styles.wrapper, containerStyle]}>
      {label && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: colors.input,
            borderColor: focused ? '#FF6B00' : error ? '#EF4444' : colors.inputBorder,
          },
        ]}
      >
        <TextInput
          style={[styles.input, { color: colors.text }]}
          placeholderTextColor={colors.placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontWeight: '400',
  },
  rightIcon: {
    marginLeft: 8,
  },
  error: {
    fontSize: 12,
    color: '#EF4444',
    marginTop: 2,
  },
});
