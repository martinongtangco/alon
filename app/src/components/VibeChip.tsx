import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, space } from '../theme';
import { Vibe } from '../types';

interface VibeChipProps {
  vibe: Vibe;
  active: boolean;
  onPress: () => void;
}

const vibeEmojis: Record<Vibe, string> = {
  tech: '💻',
  music: '🎵',
  food: '🍕',
  art: '🎨',
  fitness: '🏋️',
  startups: '🚀',
  travel: '✈️',
  gaming: '🎮',
  film: '🎬',
  reading: '📚',
};

const vibeColors: Record<Vibe, { bg: string; fg: string }> = {
  tech: { bg: colors.teal100, fg: colors.teal900 },
  music: { bg: colors.amber100, fg: colors.amber900 },
  food: { bg: colors.rust100, fg: colors.rust900 },
  art: { bg: colors.brown100, fg: colors.brown900 },
  fitness: { bg: colors.olive100, fg: colors.olive900 },
  startups: { bg: colors.teal100, fg: colors.teal900 },
  travel: { bg: colors.amber100, fg: colors.amber900 },
  gaming: { bg: colors.olive100, fg: colors.olive900 },
  film: { bg: colors.brown100, fg: colors.brown900 },
  reading: { bg: colors.rust100, fg: colors.rust900 },
};

export const VibeChip = ({ vibe, active, onPress }: VibeChipProps) => {
  const palette = vibeColors[vibe];
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? palette.bg : colors.bgBlock,
          borderColor: active ? palette.fg : colors.borderWarm,
        },
      ]}
    >
      <Text style={styles.emoji}>{vibeEmojis[vibe]}</Text>
      <Text
        style={[
          styles.label,
          { color: active ? palette.fg : colors.textMuted },
        ]}
      >
        {vibe}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
    paddingHorizontal: space.s2,
    paddingVertical: space.s1,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emoji: {
    fontSize: 12,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'lowercase',
  },
});
