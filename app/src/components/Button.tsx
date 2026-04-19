import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import { colors, radius, space } from '../theme';

interface ButtonProps {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

export const Button = ({
  label,
  onPress,
  tone = 'primary',
  disabled,
  style,
}: ButtonProps) => {
  const palette = palettes[tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border },
        disabled && { opacity: 0.4 },
        pressed && { opacity: 0.85 },
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
};

const palettes = {
  primary: { bg: colors.teal600, border: colors.teal900, fg: colors.bgWarm },
  ghost: {
    bg: 'transparent',
    border: colors.borderWarm,
    fg: colors.textPrimary,
  },
  danger: { bg: colors.rust600, border: colors.rust900, fg: colors.bgWarm },
};

const styles = StyleSheet.create({
  btn: {
    paddingHorizontal: space.s5,
    paddingVertical: space.s3,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
