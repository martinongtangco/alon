import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Accelerometer } from 'expo-sensors';
import { useNavigation } from '@react-navigation/native';
import Svg, { Circle, G } from 'react-native-svg';

import { colors } from '../../theme';
import { serifFamily } from '../../theme/typography';

type Mode = 'pulse' | 'lava' | 'constellation' | 'fracture' | 'aurora';
const MODES: Mode[] = ['pulse', 'lava', 'constellation', 'fracture', 'aurora'];

const PARTICLE_COLORS = [
  colors.particleAmberHi,
  colors.particleTeal,
  colors.particleRust,
  colors.particleOlive,
  colors.particleGold,
  colors.particleJade,
  colors.particleSiena,
];

export const VisualizerScreen = () => {
  const navigation = useNavigation();
  const [modeIndex, setModeIndex] = useState(0);
  const [intensity, setIntensity] = useState(0.4);
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    const cycle = setInterval(() => {
      setModeIndex((i) => (i + 1) % MODES.length);
    }, 6000);
    return () => clearInterval(cycle);
  }, [fade]);

  useEffect(() => {
    Accelerometer.setUpdateInterval(80);
    const sub = Accelerometer.addListener(({ x, y, z }) => {
      const mag = Math.min(2, Math.sqrt(x * x + y * y + z * z));
      setIntensity(0.2 + Math.min(1, mag / 2.5) * 0.8);
    });
    return () => sub.remove();
  }, []);

  const mode = MODES[modeIndex];

  return (
    <Pressable
      style={styles.container}
      onPress={() => setModeIndex((i) => (i + 1) % MODES.length)}
      onLongPress={() => navigation.goBack()}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
        <ModeCanvas mode={mode} intensity={intensity} />
      </Animated.View>

      <View style={styles.hud} pointerEvents="none">
        <Text style={styles.modeName}>{mode}</Text>
        <Text style={styles.hint}>tap to cycle · long-press to exit</Text>
      </View>

      <View style={styles.wordmark} pointerEvents="none">
        <Text style={styles.wordmarkText}>Alon</Text>
      </View>
    </Pressable>
  );
};

const ModeCanvas = ({
  mode,
  intensity,
}: {
  mode: Mode;
  intensity: number;
}) => {
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    spin.setValue(0);
    Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ).start();
  }, [mode, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const ringCount = mode === 'pulse' ? 7 : mode === 'aurora' ? 6 : 0;
  const blobs =
    mode === 'lava' || mode === 'constellation' || mode === 'fracture' ? 14 : 0;

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { backgroundColor: colors.bgDark, transform: [{ rotate }] },
      ]}
    >
      <Svg width="100%" height="100%" viewBox="0 0 200 400">
        <G>
          {Array.from({ length: ringCount }).map((_, i) => (
            <Circle
              key={`ring_${i}`}
              cx={100}
              cy={200}
              r={20 + i * (12 + intensity * 18)}
              fill="none"
              stroke={PARTICLE_COLORS[i % PARTICLE_COLORS.length]}
              strokeWidth={1.5 + intensity * 1.5}
              opacity={0.2 + intensity * 0.5}
            />
          ))}
          {Array.from({ length: blobs }).map((_, i) => {
            const seed = (i + 1) * 0.37;
            const r = 6 + ((i * 7) % 11) + intensity * 8;
            const cx = 30 + ((i * 53) % 140);
            const cy = 50 + ((i * 91) % 300);
            const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
            return (
              <Circle
                key={`blob_${i}`}
                cx={cx + Math.sin(seed * intensity * 6) * 12}
                cy={cy + Math.cos(seed * intensity * 6) * 12}
                r={r}
                fill={color}
                opacity={0.55 + intensity * 0.35}
              />
            );
          })}
        </G>
      </Svg>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgDarkDeep },
  hud: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 4,
  },
  modeName: {
    color: '#f5e8c8',
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  hint: {
    color: '#c9b88a',
    fontSize: 10,
    opacity: 0.7,
  },
  wordmark: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  wordmarkText: {
    color: '#f5e8c8',
    fontFamily: serifFamily,
    fontStyle: 'italic',
    fontSize: 14,
    letterSpacing: 2,
    opacity: 0.85,
  },
});
