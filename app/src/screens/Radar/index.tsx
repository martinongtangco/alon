import React, { useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Pill } from '../../components/Pill';
import { VibeSignal } from '../../components/VibeSignal';
import { useAppStore } from '../../state/store';
import { colors, space } from '../../theme';
import { bleService } from '../../services/ble';
import { hapticsService } from '../../services/haptics';
import { proximityService } from '../../services/proximity';
import { RadarMap } from './RadarMap';
import { VibeCard } from './VibeCard';
import { RootStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const RadarScreen = () => {
  const navigation = useNavigation<Nav>();
  const nearby = useAppStore((s) => s.nearby);
  const promos = useAppStore((s) => s.promos);
  const events = useAppStore((s) => s.events);
  const profile = useAppStore((s) => s.profile);
  const setNearby = useAppStore((s) => s.setNearby);
  const setSignalLevel = useAppStore((s) => s.setSignalLevel);
  const buzz = useAppStore((s) => s.buzz);
  const signalLevel = useAppStore((s) => s.signalLevel);

  const [selectedToken, setSelectedToken] = useState<string | null>(null);
  const [selectedPromo, setSelectedPromo] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [buzzResult, setBuzzResult] = useState<
    'sent' | 'rate-limited' | 'too-far' | null
  >(null);

  useEffect(() => {
    if (profile.ghostMode) {
      bleService.stop();
      return;
    }
    bleService.start();
    const unsub = bleService.subscribe((people) => {
      setNearby(people);
      setSignalLevel(proximityService.signalLevelFor(people));
    });
    return () => {
      unsub();
      bleService.stop();
    };
  }, [profile.ghostMode, setNearby, setSignalLevel]);

  const selectedPerson = useMemo(
    () => nearby.find((n) => n.token === selectedToken) ?? null,
    [nearby, selectedToken],
  );

  const selectedPromoData = useMemo(
    () => promos.find((p) => p.id === selectedPromo) ?? null,
    [promos, selectedPromo],
  );

  const selectedEventData = useMemo(
    () => events.find((e) => e.id === selectedEvent) ?? null,
    [events, selectedEvent],
  );

  const handleBuzz = async () => {
    if (!selectedPerson) return;
    const result = buzz(selectedPerson.token);
    setBuzzResult(result);
    if (result === 'sent') {
      await hapticsService.play('buzz_me');
      setTimeout(() => navigation.navigate('Visualizer'), 350);
    }
  };

  const dismiss = () => {
    setSelectedToken(null);
    setSelectedPromo(null);
    setSelectedEvent(null);
    setBuzzResult(null);
  };

  const screenWidth = Dimensions.get('window').width;
  const radarSize = Math.min(screenWidth - space.s4 * 2, 360);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeLabel}>mode</Text>
            <Text style={styles.modeValue}>{profile.mode}</Text>
          </View>
          <VibeSignal level={signalLevel} />
        </View>

        {profile.ghostMode ? (
          <View style={[styles.radarPlaceholder, { height: radarSize }]}>
            <Text style={styles.ghostText}>ghost mode is on</Text>
            <Text style={styles.ghostSub}>
              not scanning, not advertising. you're invisible.
            </Text>
          </View>
        ) : (
          <RadarMap
            size={radarSize}
            nearby={nearby}
            promos={promos}
            events={events}
            onSelectPerson={(token) => {
              setSelectedToken(token);
              setSelectedPromo(null);
              setSelectedEvent(null);
              setBuzzResult(null);
            }}
            onSelectPromo={(id) => {
              setSelectedPromo(id);
              setSelectedToken(null);
              setSelectedEvent(null);
            }}
            onSelectEvent={(id) => {
              setSelectedEvent(id);
              setSelectedToken(null);
              setSelectedPromo(null);
            }}
            onDismiss={dismiss}
          />
        )}

        <View style={styles.statRow}>
          <Pill label="people" value={nearby.length} tone="teal" />
          <Pill label="promos" value={promos.length} tone="amber" />
          <Pill label="events" value={events.length} tone="rust" />
        </View>

        <View style={styles.legend}>
          <LegendDot color={colors.teal600} label="you" />
          <LegendDot color={colors.brown600} label="people" />
          <LegendDot color={colors.amber600} label="promos" />
          <LegendDot color={colors.rust600} label="events" />
        </View>

        {selectedPerson && (
          <VibeCard
            person={selectedPerson}
            onBuzz={handleBuzz}
            onClose={dismiss}
            buzzResult={buzzResult}
          />
        )}

        {selectedPromoData && (
          <View style={styles.detailCard}>
            <Text style={styles.detailEmoji}>{selectedPromoData.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{selectedPromoData.label}</Text>
              <Text style={styles.detailBody}>{selectedPromoData.detail}</Text>
              <Text style={styles.detailMeta}>
                {selectedPromoData.distanceMeters}m away
              </Text>
            </View>
          </View>
        )}

        {selectedEventData && (
          <View style={styles.detailCard}>
            <Text style={styles.detailEmoji}>{selectedEventData.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.detailTitle}>{selectedEventData.label}</Text>
              <Text style={styles.detailBody}>{selectedEventData.detail}</Text>
              <Text style={styles.detailMeta}>
                {selectedEventData.distanceMeters}m away
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const LegendDot = ({ color, label }: { color: string; label: string }) => (
  <View style={legendStyles.row}>
    <View style={[legendStyles.dot, { backgroundColor: color }]} />
    <Text style={legendStyles.label}>{label}</Text>
  </View>
);

const legendStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s1,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
});

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.bgWarm,
  },
  scroll: {
    padding: space.s4,
    gap: space.s4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
  },
  modeLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  modeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    textTransform: 'lowercase',
  },
  radarPlaceholder: {
    backgroundColor: colors.bgWarmAlt,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.s2,
    padding: space.s4,
  },
  ghostText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  ghostSub: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
  },
  statRow: {
    flexDirection: 'row',
    gap: space.s2,
    flexWrap: 'wrap',
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s4,
  },
  detailCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgWarm,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    padding: space.s3,
    gap: space.s3,
    alignItems: 'center',
  },
  detailEmoji: {
    fontSize: 28,
  },
  detailTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  detailBody: {
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 2,
  },
  detailMeta: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 4,
    letterSpacing: 0.4,
  },
});
