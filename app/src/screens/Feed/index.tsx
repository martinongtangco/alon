import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppStore } from '../../state/store';
import { colors, space } from '../../theme';
import { FeedItem } from '../../types';

const Row = ({ item }: { item: FeedItem }) => (
  <View
    style={[
      styles.row,
      {
        borderLeftColor:
          item.kind === 'promo' ? colors.amber600 : colors.rust600,
      },
    ]}
  >
    <Text style={styles.emoji}>{item.emoji}</Text>
    <View style={{ flex: 1 }}>
      <Text style={styles.kindLabel}>
        {item.kind === 'promo' ? 'promo' : 'event'} · {item.distanceMeters}m
      </Text>
      <Text style={styles.title}>{item.title}</Text>
      <Text style={styles.body}>{item.body}</Text>
    </View>
  </View>
);

export const FeedScreen = () => {
  const feed = useAppStore((s) => s.feed);
  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <FlatList
        data={feed}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.s3 }} />}
        renderItem={({ item }) => <Row item={item} />}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgWarm },
  list: { padding: space.s4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
    backgroundColor: colors.bgWarm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    borderLeftWidth: 3,
    padding: space.s3,
  },
  emoji: { fontSize: 26 },
  kindLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textMuted,
    marginBottom: 2,
  },
  title: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  body: { fontSize: 12, color: colors.textPrimary, marginTop: 2 },
});
