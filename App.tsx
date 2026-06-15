import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useStore } from './src/store';
import { AppNavigator } from './src/navigation';
import { useColors } from './src/theme';

function AppContent() {
  const colors = useColors();
  const loadData = useStore((s) => s.loadData);
  const isLoading = useStore((s) => s.isLoading);
  const isOnboardingComplete = useStore((s) => s.isOnboardingComplete);

  useEffect(() => {
    loadData();
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <AppNavigator isOnboardingComplete={isOnboardingComplete} />
    </>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppContent />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
