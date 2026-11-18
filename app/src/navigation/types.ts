import { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Radar: undefined;
  Matches: undefined;
  Feed: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  SignIn: { onSignIn?: () => void } | undefined;
  Onboarding: undefined;
  Main: NavigatorScreenParams<TabParamList>;
  Visualizer: undefined;
};
