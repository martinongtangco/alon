import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { ALL_VIBES, Vibe } from '../types';
import { VibeChip } from './VibeChip';

interface VibeListProps {
  activeVibes: Vibe[];
  onToggle: (vibe: Vibe) => void;
}

export const VibeList = ({ activeVibes, onToggle }: VibeListProps) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>vibes</Text>
      <View style={styles.row}>
        {ALL_VIBES.map((vibe) => (
          <VibeChip
            key={vibe}
            vibe={vibe}
            active={activeVibes.includes(vibe)}
            onPress={() => onToggle(vibe)}
          />
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
});
