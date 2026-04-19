import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';
import { SignalLevel } from '../types';

interface VibeSignalProps {
  level: SignalLevel;
}

const BAR_COUNT = 5;

export const VibeSignal = ({ level }: VibeSignalProps) => {
  const anims = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.35)),
  ).current;

  useEffect(() => {
    const loops = anims.map((value, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(value, {
            toValue: 1,
            duration: 1200,
            delay: i * 90,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0.35,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [anims]);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>signal</Text>
      <View style={styles.barRow}>
        {anims.map((anim, i) => {
          const active = i < level;
          const color = colorForBar(i, level);
          return (
            <Animated.View
              key={i}
              style={[
                styles.bar,
                {
                  height: 8 + i * 3,
                  backgroundColor: active ? color : colors.bgBlock,
                  opacity: active ? anim : 0.35,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
};

const colorForBar = (i: number, level: SignalLevel) => {
  if (i >= level) return colors.bgBlock;
  if (level >= 4) return colors.rust600;
  if (level >= 2) return colors.amber600;
  return colors.olive600;
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: space.s2,
    paddingHorizontal: space.s3,
    backgroundColor: colors.bgWarm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    alignItems: 'center',
    gap: space.s1,
  },
  label: {
    fontSize: 8,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
});
