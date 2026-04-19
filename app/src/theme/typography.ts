import { Platform, TextStyle } from 'react-native';
import { colors } from './colors';

export const serifFamily = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia',
}) as string;

export const type: Record<string, TextStyle> = {
  wordmark: {
    fontFamily: serifFamily,
    fontStyle: 'italic',
    fontSize: 15,
    letterSpacing: 1.8,
    color: colors.textPrimary,
  },
  microLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  bodyMuted: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textMuted,
  },
  stat: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  tooltipName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  tooltipSub: {
    fontSize: 10,
    fontWeight: '400',
    color: colors.textMuted,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.bgWarm,
    letterSpacing: 0.4,
  },
};
