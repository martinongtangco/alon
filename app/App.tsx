import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text } from 'react-native';
import * as Notifications from 'expo-notifications';
import { RootNavigator } from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { bootstrapDevice } from './src/services/bootstrap';
import { colors, type } from './src/theme';

// Configure how notifications are handled when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

function NotificationListener() {
  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const { type } = response.notification.request.content.data ?? {};
      if (!navigationRef.isReady()) return;
      if (type === 'buzz') navigationRef.navigate('Main', { screen: 'Radar' });
      if (type === 'reveal') navigationRef.navigate('Main', { screen: 'Matches' });
      if (type === 'promo') navigationRef.navigate('Main', { screen: 'Feed' });
    });

    return () => subscription.remove();
  }, []);

  return null;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    bootstrapDevice().finally(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bgDark }}>
        <Text
          style={{
            ...type.wordmark,
            color: colors.textMuted,
            textAlign: 'center',
            marginTop: 40,
          }}
        >
          Alon
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <NotificationListener />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
