import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/Button';
import { useAppStore } from '../../state/store';
import { ALL_MODES, ALL_VIBES, Mode, Vibe } from '../../types';
import { colors, radius, space } from '../../theme';
import { serifFamily } from '../../theme/typography';

const STEPS = ['intro', 'name', 'vibes', 'mode', 'permissions'] as const;
type Step = (typeof STEPS)[number];

export const OnboardingScreen = () => {
  const completeOnboarding = useAppStore((s) => s.completeOnboarding);
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [vibes, setVibes] = useState<Vibe[]>([]);
  const [mode, setMode] = useState<Mode>('networking');

  const step: Step = STEPS[stepIndex];
  const initials = useMemo(() => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'YO';
    const first = parts[0][0];
    const second = parts[1]?.[0] ?? parts[0][1] ?? '';
    return (first + second).toUpperCase();
  }, [name]);

  const canAdvance = (() => {
    if (step === 'name') return name.trim().length > 0;
    if (step === 'vibes') return vibes.length >= 1;
    return true;
  })();

  const advance = () => {
    if (stepIndex < STEPS.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      completeOnboarding({
        name: name.trim() || 'You',
        initials,
        bio: bio.trim() || undefined,
        vibes,
        mode,
        ghostMode: false,
      });
    }
  };

  const back = () => stepIndex > 0 && setStepIndex(stepIndex - 1);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.brand}>vibr8.me</Text>
        <Text style={styles.tagline}>feel who's near</Text>

        <StepDots count={STEPS.length} current={stepIndex} />

        <View style={styles.body}>
          {step === 'intro' && (
            <View style={styles.section}>
              <Text style={styles.h1}>set it. forget it. feel it.</Text>
              <Text style={styles.p}>
                vibr8 runs in your pocket. when someone compatible comes near,
                your phone buzzes. no chat, no scrolling — just go say hi.
              </Text>
            </View>
          )}

          {step === 'name' && (
            <View style={styles.section}>
              <Text style={styles.h1}>what should we call you?</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="your name"
                placeholderTextColor={colors.textDim}
                style={styles.input}
                autoFocus
              />
              <TextInput
                value={bio}
                onChangeText={setBio}
                placeholder="a short bio (optional)"
                placeholderTextColor={colors.textDim}
                style={styles.input}
              />
              <Text style={styles.hint}>
                only your initials show up to others — full name only after a
                mutual reveal.
              </Text>
            </View>
          )}

          {step === 'vibes' && (
            <View style={styles.section}>
              <Text style={styles.h1}>what are your vibes?</Text>
              <Text style={styles.p}>pick at least one. shared vibes = stronger buzz.</Text>
              <View style={styles.chipWrap}>
                {ALL_VIBES.map((v) => {
                  const active = vibes.includes(v);
                  return (
                    <Pressable
                      key={v}
                      onPress={() =>
                        setVibes((prev) =>
                          active ? prev.filter((x) => x !== v) : [...prev, v],
                        )
                      }
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: colors.amber600,
                          borderColor: colors.amber900,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          active && { color: colors.bgWarm },
                        ]}
                      >
                        {v}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'mode' && (
            <View style={styles.section}>
              <Text style={styles.h1}>what's your mode?</Text>
              <Text style={styles.p}>you can change this anytime.</Text>
              <View style={styles.chipWrap}>
                {ALL_MODES.map((m) => {
                  const active = mode === m;
                  return (
                    <Pressable
                      key={m}
                      onPress={() => setMode(m)}
                      style={[
                        styles.chip,
                        active && {
                          backgroundColor: colors.teal600,
                          borderColor: colors.teal900,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipLabel,
                          active && { color: colors.bgWarm },
                        ]}
                      >
                        {m}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )}

          {step === 'permissions' && (
            <View style={styles.section}>
              <Text style={styles.h1}>one more thing</Text>
              <Text style={styles.p}>
                vibr8 needs bluetooth and approximate location to feel who's
                near. battery target: 3–6% per hour, comparable to spotify.
              </Text>
              <Text style={styles.p}>
                this prototype uses mocked data — no real bluetooth or location
                is requested yet.
              </Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          {stepIndex > 0 ? (
            <Button label="back" tone="ghost" onPress={back} />
          ) : (
            <View style={{ width: 80 }} />
          )}
          <Button
            label={step === 'permissions' ? "let's go" : 'next'}
            tone="primary"
            onPress={advance}
            disabled={!canAdvance}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const StepDots = ({
  count,
  current,
}: {
  count: number;
  current: number;
}) => (
  <View style={styles.dots}>
    {Array.from({ length: count }).map((_, i) => (
      <View
        key={i}
        style={[
          styles.dot,
          i === current && { backgroundColor: colors.teal600, width: 18 },
        ]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgWarm },
  scroll: { padding: space.s4, gap: space.s5, flexGrow: 1 },
  brand: {
    fontFamily: serifFamily,
    fontStyle: 'italic',
    fontSize: 22,
    letterSpacing: 2,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: space.s4,
  },
  tagline: {
    textAlign: 'center',
    color: colors.textMuted,
    fontSize: 12,
    letterSpacing: 1,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: space.s2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgBlock,
  },
  body: { flex: 1, gap: space.s4 },
  section: { gap: space.s3 },
  h1: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 28,
  },
  p: { fontSize: 13, color: colors.textPrimary, lineHeight: 19 },
  hint: { fontSize: 11, color: colors.textMuted },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    borderRadius: 12,
    paddingHorizontal: space.s3,
    paddingVertical: space.s3,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.bgWarmAlt,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 },
  chip: {
    paddingHorizontal: space.s4,
    paddingVertical: space.s2,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    backgroundColor: colors.bgWarmAlt,
  },
  chipLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: space.s4,
  },
});
