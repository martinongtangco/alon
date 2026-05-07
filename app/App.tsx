import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { View, Text } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { bootstrapDevice } from './src/services/bootstrap';
import { colors, type } from './src/theme';

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
          vibr8.me
        </Text>
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
