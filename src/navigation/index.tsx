import React from 'react';
import { View, Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../theme';

import { WelcomeScreen } from '../screens/onboarding/WelcomeScreen';
import { SetupScreen } from '../screens/onboarding/SetupScreen';
import { PremiumScreen } from '../screens/onboarding/PremiumScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { InboxScreen } from '../screens/InboxScreen';
import { PlannerScreen } from '../screens/PlannerScreen';
import { TasksScreen } from '../screens/TasksScreen';
import { FocusScreen } from '../screens/FocusScreen';
import { WeeklyReviewScreen } from '../screens/WeeklyReviewScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { AssistantScreen } from '../screens/AssistantScreen';
import { MealPlannerScreen } from '../screens/MealPlannerScreen';
import { RemindersScreen } from '../screens/RemindersScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  const colors = useColors();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 24 : 8,
          paddingTop: 8,
          height: Platform.OS === 'ios' ? 84 : 68,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginTop: -4 },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Planner"
        component={PlannerScreen}
        options={{
          tabBarLabel: 'Planner',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'calendar' : 'calendar-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          tabBarLabel: 'Pilot',
          tabBarIcon: ({ focused }) => (
            <View
              style={{
                width: 52, height: 52, borderRadius: 26,
                backgroundColor: focused ? colors.accent : colors.accentLight,
                alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                shadowColor: colors.accent, shadowOffset: { width: 0, height: 4 },
                shadowOpacity: focused ? 0.4 : 0, shadowRadius: 8, elevation: focused ? 6 : 0,
              }}
            >
              <Ionicons name="sparkles" size={24} color={focused ? '#FFF' : colors.accent} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="Kitchen"
        component={MealPlannerScreen}
        options={{
          tabBarLabel: 'Kitchen',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'restaurant' : 'restaurant-outline'} size={22} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Reminders"
        component={RemindersScreen}
        options={{
          tabBarLabel: 'Reminders',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={22} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator({ isOnboardingComplete }: { isOnboardingComplete: boolean }) {
  const colors = useColors();

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
        initialRouteName={isOnboardingComplete ? 'Main' : 'Welcome'}
      >
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="Setup" component={SetupScreen} />
        <Stack.Screen name="Premium" component={PremiumScreen} />
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="Tasks" component={TasksScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Inbox" component={InboxScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Focus" component={FocusScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="WeeklyReview" component={WeeklyReviewScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="Settings" component={SettingsScreen} options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
