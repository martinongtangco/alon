import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, space } from '../theme';
import { ALL_MODES, Mode } from '../types';

interface ModeSelectorProps {
  mode: Mode;
  onSelect: (mode: Mode) => void;
}

const modeLabels: Record<Mode, { label: string; emoji: string }> = {
  networking: { label: 'networking', emoji: '🤝' },
  chill: { label: 'chill', emoji: '😌' },
  dating: { label: 'dating', emoji: '💕' },
  explorer: { label: 'explorer', emoji: '🧭' },
};

export const ModeSelector = ({ mode, onSelect }: ModeSelectorProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>mode</Text>
      <View style={styles.row}>
        {ALL_MODES.map((m) => (
          <Pressable
            key={m}
            onPress={() => onSelect(m)}
            style={[
              styles.btn,
              {
                backgroundColor: mode === m ? colors.teal100 : colors.bgBlock,
                borderColor: mode === m ? colors.teal600 : colors.borderWarm,
              },
            ]}
          >
            <Text style={styles.emoji}>{modeLabels[m].emoji}</Text>
            <Text
              style={[
                styles.label,
                { color: mode === m ? colors.teal900 : colors.textMuted },
              ]}
            >
              {modeLabels[m].label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: space.s2,
  },
  title: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s3,
    paddingVertical: space.s2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: {
    fontSize: 14,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },
});
