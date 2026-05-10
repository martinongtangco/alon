import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { useAppStore } from '../../state/store';
import { colors, space } from '../../theme';
import { BuzzMatch } from '../../types';
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
      <View style={{ flex: 1, gap: 4 }}>
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

export const MatchesScreen = () => {
  const matches = useAppStore((s) => s.matches);
  const buzzBack = useAppStore((s) => s.buzzBack);

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
              when someone buzzes you, they'll show up here
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
});
