import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '../theme';

interface OfflineBannerProps {
  isConnected: boolean;
}

export const OfflineBanner = ({ isConnected }: OfflineBannerProps) => {
  if (isConnected) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>◌  not connected — nearby detection only</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: colors.amber100,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.amber600,
    borderRadius: 8,
    padding: space.s2,
    alignItems: 'center',
  },
  text: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.amber900,
    letterSpacing: 0.4,
  },
});