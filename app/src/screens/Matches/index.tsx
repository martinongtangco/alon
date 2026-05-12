import React, { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { useAppStore } from '../../state/store';
import { colors, space } from '../../theme';
import { BuzzMatch, RevealMatch } from '../../types';
import { hapticsService } from '../../services/haptics';

const MatchRow = ({
  match,
  onBuzzBack,
}: {
  match: BuzzMatch;
  onBuzzBack: () => void;
}) => {
  const minutesAgo = Math.max(1, Math.round((Date.now() - match.receivedAt) / 60000));
  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{match.initials}</Text>
      </View>
      <View style={styles.rowContent}>
        <Text style={styles.name}>
          {match.status === 'mutual' ? match.name ?? match.initials : 'someone nearby'}
        </Text>
        <View style={styles.vibeRow}>
          {match.vibes.map((v) => (
            <Pill key={v} label={v} tone="teal" />
          ))}
        </View>
        <Text style={styles.meta}>
          {match.status === 'mutual'
            ? 'mutual — go say hi'
            : `buzzed you ${minutesAgo}m ago`}
        </Text>
      </View>
      {match.status === 'pending' && (
        <Button label="buzz back" tone="primary" onPress={onBuzzBack} />
      )}
    </View>
  );
};

const RevealRow = ({
  match,
  onRemove,
}: {
  match: RevealMatch;
  onRemove: () => void;
}) => (
  <View style={styles.row}>
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{match.initials}</Text>
    </View>
    <View style={styles.rowContent}>
      <Text style={styles.name}>{match.name ?? match.initials}</Text>
      <View style={styles.vibeRow}>
        {match.vibes.map((v) => (
          <Pill key={v} label={v} tone="amber" />
        ))}
      </View>
      <Text style={styles.meta}>
        revealed {new Date(match.mutual_at).toLocaleDateString()}
      </Text>
    </View>
    <Button label="remove" tone="danger" onPress={onRemove} />
  </View>
);

export const MatchesScreen = () => {
  const matches = useAppStore((s) => s.matches);
  const revealMatches = useAppStore((s) => s.revealMatches);
  const buzzBack = useAppStore((s) => s.buzzBack);
  const removeReveal = useAppStore((s) => s.removeReveal);
  const fetchRevealMatches = useAppStore((s) => s.fetchRevealMatches);

  useEffect(() => {
    fetchRevealMatches();
  }, [fetchRevealMatches]);

  const hasBuzzMatches = matches.length > 0;
  const hasRevealMatches = revealMatches.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={hasRevealMatches ? revealMatches : matches}
        keyExtractor={(item) => (hasRevealMatches ? (item as RevealMatch).id : (item as BuzzMatch).id)}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>nothing yet</Text>
            <Text style={styles.emptyBody}>
              {hasRevealMatches
                ? 'when someone reveals to you, they\'ll show up here'
                : 'when someone buzzes you, they\'ll show up here'}
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          hasRevealMatches ? (
            <RevealRow
              match={item as RevealMatch}
              onRemove={() => {
                removeReveal((item as RevealMatch).id);
                hapticsService.play('soft');
              }}
            />
          ) : (
            <MatchRow
              match={item as BuzzMatch}
              onBuzzBack={() => {
                buzzBack((item as BuzzMatch).id);
                hapticsService.play('buzz_me');
              }}
            />
          )
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgWarm },
  list: { padding: space.s4, flexGrow: 1 },
  sep: { height: space.s3 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    backgroundColor: colors.surfaceWarm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    padding: space.s3,
  },
  rowContent: { flex: 1, gap: 4 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.brown600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.bgWarm, fontWeight: '700', fontSize: 14 },
  name: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  vibeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  meta: { fontSize: 11, color: colors.textMuted },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
    paddingVertical: space.s8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary },
  emptyBody: { fontSize: 12, color: colors.textMuted },
});