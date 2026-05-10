import * as Haptics from 'expo-haptics';

export type HapticPattern =
  | 'faint_pulse'
  | 'steady_rhythm'
  | 'strong_buzz'
  | 'buzz_me';

async function play(pattern: HapticPattern): Promise<void> {
  switch (pattern) {
    case 'faint_pulse':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      return;
    case 'steady_rhythm':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await wait(140);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      return;
    case 'strong_buzz':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      return;
    case 'buzz_me':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await wait(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      await wait(80);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      return;
  }
}

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export const hapticsService = {
  play,
};
