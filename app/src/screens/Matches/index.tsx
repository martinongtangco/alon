import React, { useEffect, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { useAppStore } from '../../state/store';
import { colors, space } from '../../theme';
import { hapticsService } from '../../services/haptics';

const POLL_INTERVAL_MS = 15000;

const MatchRow = ({
  match,
  onBuzzBack,
}: {
  match: { id: string; displayName: string; vibes: string[]; mode: string; status: 'pending' | 'mutual'; createdAt: number };
  onBuzzBack: () => void;
}) => {
  const minutesAgo = Math.max(1, Math.round((Date.now() - match.createdAt) / 60000));
  const initials = match.displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initials}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.name}>{match.displayName}</Text>
        <View style={styles.vibeRow}>
          {match.vibes.map((v) => (
            <Pill key={v} label={v} tone="teal" />
          ))}
        </View>
        <Text style={styles.meta}>
          {match.status === 'mutual'
            ? 'mutual — go say hi'
            : `revealed ${minutesAgo}m ago`}
        </Text>
      </View>
      {match.status === 'pending' && (
        <Button label="buzz back" tone="primary" onPress={onBuzzBack} />
      )}
    </View>
  );
};

export const MatchesScreen = () => {
  const matches = useAppStore((s) => s.matches);
  const fetchMatches = useAppStore((s) => s.fetchMatches);
  const buzzBack = useAppStore((s) => s.buzzBack);
  const [polling, setPolling] = useState(false);

  // Poll for new matches every 15 seconds while screen is focused
  useEffect(() => {
    setPolling(true);
    // Initial fetch
    fetchMatches();

    const interval = setInterval(() => {
      fetchMatches();
    }, POLL_INTERVAL_MS);

    return () => {
      setPolling(false);
      clearInterval(interval);
    };
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={matches}
        keyExtractor={(m) => m.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>nothing yet</Text>
            <Text style={styles.emptyBody}>
              when someone reveals to you, they'll show up here
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <MatchRow
            match={item}
            onBuzzBack={() => {
              buzzBack(item.id);
              hapticsService.play('buzz_me');
            }}
          />
        )}
      />
      {polling && (
        <View style={styles.pollingIndicator}>
          <Text style={styles.pollingText}>polling every 15s</Text>
        </View>
      )}
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
    backgroundColor: colors.bgWarm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    padding: space.s3,
  },
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
  pollingIndicator: {
    alignItems: 'center',
    paddingVertical: space.s2,
  },
  pollingText: {
    fontSize: 10,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});