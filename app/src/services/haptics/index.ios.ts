import { Haptics, ImpactFeedbackStyle, NotificationFeedbackType } from 'expo-haptics';

export type HapticPattern =
  | 'faint_pulse'
  | 'steady_rhythm'
  | 'strong_buzz'
  | 'buzz_me';

async function play(pattern: HapticPattern): Promise<void> {
  switch (pattern) {
    case 'faint_pulse':
      await Haptics.impactAsync(ImpactFeedbackStyle.Light);
      return;
    case 'steady_rhythm':
      // iOS: single Medium impact (CoreHaptics rhythm patterns require native module)
      // Pragmatic approximation — see ADR 0030
      await Haptics.impactAsync(ImpactFeedbackStyle.Medium);
      return;
    case 'strong_buzz':
      await Haptics.impactAsync(ImpactFeedbackStyle.Heavy);
      return;
    case 'buzz_me':
      await Haptics.notificationAsync(NotificationFeedbackType.Success);
      return;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const hapticsService = {
  play,
};