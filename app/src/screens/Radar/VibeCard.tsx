import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '../../components/Button';
import { Pill } from '../../components/Pill';
import { colors, radius, space } from '../../theme';
import { NearbyPerson } from '../../types';

interface VibeCardProps {
  person: NearbyPerson;
  onBuzz: () => void;
  onClose: () => void;
  buzzResult?: 'sent' | 'rate-limited' | 'too-far' | null;
}

export const VibeCard = ({
  person,
  onBuzz,
  onClose,
  buzzResult,
}: VibeCardProps) => {
  const tooFar = person.distanceMeters > 100;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{person.initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.distance}>
            {Math.round(person.distanceMeters)}m away
          </Text>
          <Text style={styles.compat}>
            {Math.round(person.compatibility * 100)}% vibe match
          </Text>
        </View>
      </View>

      <View style={styles.vibeRow}>
        {person.vibes.map((v) => (
          <Pill key={v} label={v} tone="teal" />
        ))}
      </View>

      <Text style={styles.icebreaker}>"{person.icebreaker}"</Text>

      {buzzResult === 'sent' && (
        <Text style={[styles.feedback, { color: colors.olive900 }]}>
          buzz sent — wait for them to buzz back
        </Text>
      )}
      {buzzResult === 'rate-limited' && (
        <Text style={[styles.feedback, { color: colors.rust900 }]}>
          you've buzzed them three times today — give it a rest
        </Text>
      )}
      {buzzResult === 'too-far' && (
        <Text style={[styles.feedback, { color: colors.rust900 }]}>
          too far away — get within 100m to buzz
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="close" tone="ghost" onPress={onClose} />
        <Button
          label="Buzz Me"
          tone="primary"
          onPress={onBuzz}
          disabled={tooFar}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgWarm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderWarm,
    padding: space.s4,
    gap: space.s3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.s3,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brown600,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.bgWarm,
    fontWeight: '700',
    fontSize: 16,
  },
  distance: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  compat: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  vibeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.s2,
  },
  icebreaker: {
    fontSize: 13,
    color: colors.textPrimary,
    fontStyle: 'italic',
  },
  feedback: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: space.s2,
  },
});
