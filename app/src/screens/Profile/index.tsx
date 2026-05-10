import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../state/store';
import { ALL_MODES, ALL_VIBES, Mode, Vibe } from '../../types';
import { colors, radius, space } from '../../theme';

export const ProfileScreen = () => {
  const profile = useAppStore((s) => s.profile);
  const setMode = useAppStore((s) => s.setMode);
  const toggleVibe = useAppStore((s) => s.toggleVibe);
  const toggleGhost = useAppStore((s) => s.toggleGhostMode);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.identity}>
          <View style={styles.bigAvatar}>
            <Text style={styles.bigAvatarText}>{profile.initials}</Text>
          </View>
          <Text style={styles.name}>{profile.name}</Text>
          {profile.bio && <Text style={styles.bio}>{profile.bio}</Text>}
        </View>

        <Section title="ghost mode">
          <View style={styles.ghostRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>
                {profile.ghostMode ? 'on — invisible' : 'off — discoverable'}
              </Text>
              <Text style={styles.rowSub}>
                halts BLE scanning and advertising completely
              </Text>
            </View>
            <Switch
              value={profile.ghostMode}
              onValueChange={toggleGhost}
              trackColor={{ false: colors.bgBlock, true: colors.teal600 }}
              thumbColor={colors.bgWarm}
            />
          </View>
        </Section>

        <Section title="mode">
          <View style={styles.chipWrap}>
            {ALL_MODES.map((m) => {
              const active = profile.mode === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m as Mode)}
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
        </Section>

        <Section title="vibes">
          <View style={styles.chipWrap}>
            {ALL_VIBES.map((v) => {
              const active = profile.vibes.includes(v);
              return (
                <Pressable
                  key={v}
                  onPress={() => toggleVibe(v as Vibe)}
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
        </Section>

        <Section title="battery">
          <Text style={styles.rowSub}>
            Alon used 2% in the last hour (mock telemetry)
          </Text>
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
};

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {children}
  </View>
);

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgWarm },
  scroll: { padding: space.s4, gap: space.s5 },
  identity: { alignItems: 'center', gap: space.s2 },
  bigAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brown600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bigAvatarText: { color: colors.bgWarm, fontSize: 28, fontWeight: '700' },
  name: { fontSize: 18, fontWeight: '700', color: colors.textPrimary },
  bio: { fontSize: 12, color: colors.textMuted },
  section: { gap: space.s3 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  ghostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgWarmAlt,
    padding: space.s3,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    gap: space.s3,
  },
  rowLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
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
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.4,
  },
});
