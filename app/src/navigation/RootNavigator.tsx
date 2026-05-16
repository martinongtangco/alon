import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useAppStore } from '../state/store';
import { colors, type } from '../theme';
import { RadarScreen } from '../screens/Radar';
import { MatchesScreen } from '../screens/Matches';
import { FeedScreen } from '../screens/Feed';
import { ProfileScreen } from '../screens/Profile';
import { VisualizerScreen } from '../screens/Visualizer';
import { OnboardingScreen } from '../screens/Onboarding';
import { SignInScreen } from '../screens/SignIn';
import { RootStackParamList, TabParamList } from './types';
import { navigationRef } from './navigationRef';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TabIcon = ({ glyph, focused }: { glyph: string; focused: boolean }) => (
  <View style={{ alignItems: 'center', justifyContent: 'center' }}>
    <Text
      style={{
        fontSize: 18,
        color: focused ? colors.teal600 : colors.textMuted,
      }}
    >
      {glyph}
    </Text>
  </View>
);

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.bgWarm },
      headerTitleStyle: type.wordmark,
      headerTitleAlign: 'center',
      tabBarStyle: {
        backgroundColor: colors.bgWarm,
        borderTopColor: colors.borderWarm,
      },
      tabBarActiveTintColor: colors.teal600,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarLabelStyle: { fontSize: 10, letterSpacing: 0.6 },
    }}
  >
    <Tab.Screen
      name="Radar"
      component={RadarScreen}
      options={{
        title: 'Alon',
        tabBarIcon: ({ focused }) => <TabIcon glyph="◎" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Matches"
      component={MatchesScreen}
      options={{
        title: 'matches',
        tabBarIcon: ({ focused }) => <TabIcon glyph="♥" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Feed"
      component={FeedScreen}
      options={{
        title: 'feed',
        tabBarIcon: ({ focused }) => <TabIcon glyph="≡" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Profile"
      component={ProfileScreen}
      options={{
        title: 'profile',
        tabBarIcon: ({ focused }) => <TabIcon glyph="●" focused={focused} />,
      }}
    />
  </Tab.Navigator>
);

const RootNavigatorInner = () => {
  const onboarded = useAppStore((s) => s.onboarded);
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!onboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Visualizer"
            component={VisualizerScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
};

export const RootNavigator = () => {
  const [showSignIn, setShowSignIn] = useState(false);
  const onboarded = useAppStore((s) => s.onboarded);

  useEffect(() => {
    const checkUserToken = async () => {
      const token = await AsyncStorage.getItem('userToken');
      const expiresAt = await AsyncStorage.getItem('userTokenExpiresAt');
      if (token && expiresAt && Date.now() < Number(expiresAt)) {
        // User has a valid token — skip sign-in
        return;
      }
      // No valid token — show sign-in
      setShowSignIn(true);
    };
    checkUserToken();
  }, [onboarded]);

  const handleSignIn = () => {
    setShowSignIn(false);
  };

  if (showSignIn && !onboarded) {
    return (
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SignIn" component={SignInScreen} initialParams={{ onSignIn: handleSignIn }} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {showSignIn ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="SignIn" component={SignInScreen} />
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Visualizer"
            component={VisualizerScreen}
            options={{ presentation: 'fullScreenModal' }}
          />
        </Stack.Navigator>
      ) : (
        <RootNavigatorInner />
      )}
    </NavigationContainer>
  );
};
