import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Easing,
  GestureResponderEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import { colors, space } from '../../theme';
import { MapEvent, MapPromo, NearbyPerson } from '../../types';

interface RadarMapProps {
  size: number;
  nearby: NearbyPerson[];
  promos: MapPromo[];
  events: MapEvent[];
  onSelectPerson: (token: string) => void;
  onSelectPromo: (id: string) => void;
  onSelectEvent: (id: string) => void;
  onDismiss: () => void;
}

const MAX_RADIUS_M = 250;
const RING_M = [50, 100, 250];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export const RadarMap = ({
  size,
  nearby,
  promos,
  events,
  onSelectPerson,
  onSelectPromo,
  onSelectEvent,
  onDismiss,
}: RadarMapProps) => {
  const center = size / 2;
  const maxR = size / 2 - 10;
  const sweepRotation = useRef(new Animated.Value(0)).current;
  const pulseA = useRef(new Animated.Value(0)).current;
  const pulseB = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const sweep = Animated.loop(
      Animated.timing(sweepRotation, {
        toValue: 1,
        duration: 4000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    sweep.start();

    const pulseLoop = (val: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.quad),
            useNativeDriver: false,
          }),
          Animated.timing(val, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ]),
      );
    const a = pulseLoop(pulseA, 0);
    const b = pulseLoop(pulseB, 500);
    a.start();
    b.start();

    return () => {
      sweep.stop();
      a.stop();
      b.stop();
    };
  }, [sweepRotation, pulseA, pulseB]);

  const sweepStyle = {
    transform: [
      {
        rotate: sweepRotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const ringRadii = useMemo(
    () => RING_M.map((m) => (m / MAX_RADIUS_M) * maxR),
    [maxR],
  );

  const pulseRadiusA = pulseA.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 36],
  });
  const pulseRadiusB = pulseB.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 36],
  });
  const pulseOpacityA = pulseA.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });
  const pulseOpacityB = pulseB.interpolate({
    inputRange: [0, 1],
    outputRange: [0.6, 0],
  });

  const handleBackdropPress = (_: GestureResponderEvent) => {
    onDismiss();
  };

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleBackdropPress}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.bgWarmAlt} />
              <Stop offset="1" stopColor={colors.bgBlock} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size} height={size} fill="url(#grid)" />
          <CityGrid size={size} />
          {ringRadii.map((r, i) => (
            <Circle
              key={`ring_${i}`}
              cx={center}
              cy={center}
              r={r}
              fill="none"
              stroke={colors.teal600}
              strokeOpacity={0.25}
              strokeWidth={1}
            />
          ))}
        </Svg>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.sweep,
            { width: size, height: size, borderRadius: size / 2 },
            sweepStyle,
          ]}
        >
          <View
            style={{
              position: 'absolute',
              left: size / 2,
              top: 0,
              bottom: size / 2,
              width: 1,
              backgroundColor: colors.teal600,
              opacity: 0.5,
            }}
          />
          <View
            style={{
              position: 'absolute',
              left: size / 2 - 1,
              top: 0,
              bottom: size / 2,
              width: 18,
              backgroundColor: colors.teal600,
              opacity: 0.08,
            }}
          />
        </Animated.View>

        <Svg
          width={size}
          height={size}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        >
          <AnimatedCircle
            cx={center}
            cy={center}
            r={pulseRadiusA as unknown as number}
            stroke={colors.teal600}
            strokeWidth={1.5}
            fill="none"
            opacity={pulseOpacityA as unknown as number}
          />
          <AnimatedCircle
            cx={center}
            cy={center}
            r={pulseRadiusB as unknown as number}
            stroke={colors.teal600}
            strokeWidth={1.5}
            fill="none"
            opacity={pulseOpacityB as unknown as number}
          />
        </Svg>
      </Pressable>

      <View
        pointerEvents="none"
        style={[styles.you, { left: center - 9, top: center - 9 }]}
      >
        <View style={styles.youDot} />
      </View>

      {nearby.map((p) => {
        const pos = polarToXY(p.distanceMeters, p.bearingDeg, center, maxR);
        return (
          <Pressable
            key={p.token}
            onPress={() => onSelectPerson(p.token)}
            style={[
              styles.personDot,
              { left: pos.x - 18, top: pos.y - 18 },
              dotSizeForCompat(p.compatibility),
            ]}
          >
            <Text style={styles.personInitials}>{p.initials}</Text>
          </Pressable>
        );
      })}

      {promos.map((promo) => {
        const pos = polarToXY(
          promo.distanceMeters,
          promo.bearingDeg,
          center,
          maxR,
        );
        return (
          <Pressable
            key={promo.id}
            onPress={() => onSelectPromo(promo.id)}
            style={[styles.promoChip, { left: pos.x - 14, top: pos.y - 14 }]}
          >
            <Text style={styles.chipEmoji}>{promo.emoji}</Text>
          </Pressable>
        );
      })}

      {events.map((evt) => {
        const pos = polarToXY(
          evt.distanceMeters,
          evt.bearingDeg,
          center,
          maxR,
        );
        return (
          <Pressable
            key={evt.id}
            onPress={() => onSelectEvent(evt.id)}
            style={[styles.eventChip, { left: pos.x - 14, top: pos.y - 14 }]}
          >
            <Text style={styles.chipEmoji}>{evt.emoji}</Text>
          </Pressable>
        );
      })}

      {RING_M.map((m, i) => (
        <Text
          key={`label_${m}`}
          style={[
            styles.ringLabel,
            { top: center - ringRadii[i] - 14, left: center + 4 },
          ]}
        >
          {m}m
        </Text>
      ))}
    </View>
  );
};

const polarToXY = (
  distanceM: number,
  bearingDeg: number,
  center: number,
  maxR: number,
) => {
  const r = Math.min(distanceM, MAX_RADIUS_M) / MAX_RADIUS_M * maxR;
  const rad = ((bearingDeg - 90) * Math.PI) / 180;
  return {
    x: center + r * Math.cos(rad),
    y: center + r * Math.sin(rad),
  };
};

const dotSizeForCompat = (c: number) => ({
  width: 36 + c * 8,
  height: 36 + c * 8,
  borderRadius: (36 + c * 8) / 2,
});

const CityGrid = ({ size }: { size: number }) => {
  const lines: React.ReactElement[] = [];
  const step = size / 8;
  for (let i = 1; i < 8; i++) {
    lines.push(
      <Line
        key={`v_${i}`}
        x1={i * step}
        y1={0}
        x2={i * step}
        y2={size}
        stroke={colors.bgRoad}
        strokeWidth={1}
      />,
      <Line
        key={`h_${i}`}
        x1={0}
        y1={i * step}
        x2={size}
        y2={i * step}
        stroke={colors.bgRoad}
        strokeWidth={1}
      />,
    );
  }
  return <G>{lines}</G>;
};

const styles = StyleSheet.create({
  wrapper: {
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    backgroundColor: colors.bgWarmAlt,
  },
  sweep: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  you: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.teal600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  youDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgWarm,
  },
  personDot: {
    position: 'absolute',
    backgroundColor: colors.brown600,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bgWarm,
  },
  personInitials: {
    color: colors.bgWarm,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  promoChip: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.amber100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.amber600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventChip: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: colors.rust100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.rust600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipEmoji: {
    fontSize: 14,
  },
  ringLabel: {
    position: 'absolute',
    fontSize: 9,
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.6,
  },
});
