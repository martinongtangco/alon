import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors, radius, space } from '../theme';

interface PillProps {
  label: string;
  value?: string | number;
  tone?: 'teal' | 'amber' | 'rust' | 'olive' | 'neutral';
  style?: ViewStyle;
}

const tones = {
  teal: { bg: colors.teal100, fg: colors.teal900 },
  amber: { bg: colors.amber100, fg: colors.amber900 },
  rust: { bg: colors.rust100, fg: colors.rust900 },
  olive: { bg: colors.olive100, fg: colors.olive900 },
  neutral: { bg: colors.bgBlock, fg: colors.textPrimary },
};

export const Pill = ({ label, value, tone = 'neutral', style }: PillProps) => {
  const palette = tones[tone];
  return (
    <View
      style={[
        styles.pill,
        { backgroundColor: palette.bg, borderColor: colors.borderWarm },
        style,
      ]}
    >
      {value !== undefined && (
        <Text style={[styles.value, { color: palette.fg }]}>{value}</Text>
      )}
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s2,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  value: {
    fontSize: 13,
    fontWeight: '700',
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'lowercase',
  },
});
