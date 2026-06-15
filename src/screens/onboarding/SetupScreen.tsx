import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useStore } from '../../store';
import { Button } from '../../components/Button';
import { useColors, spacing, radius, fontSize, fontWeight } from '../../theme';

type Props = {
  navigation: NativeStackNavigationProp<any>;
};

const ROLES = [
  { id: 'student', label: 'Student', icon: '📚', desc: 'Manage assignments & deadlines' },
  { id: 'professional', label: 'Professional', icon: '💼', desc: 'Organize meetings & projects' },
  { id: 'entrepreneur', label: 'Entrepreneur', icon: '🚀', desc: 'Build & execute on your vision' },
  { id: 'other', label: 'Other', icon: '✨', desc: 'Live a more organized life' },
];

const WAKE_TIMES = ['5:00 AM', '6:00 AM', '7:00 AM', '8:00 AM', '9:00 AM'];

export function SetupScreen({ navigation }: Props) {
  const colors = useColors();
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [wakeTime, setWakeTime] = useState('7:00 AM');
  const slideAnim = useRef(new Animated.Value(0)).current;

  const goNext = () => {
    Animated.timing(slideAnim, {
      toValue: -20,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setStep((s) => s + 1);
      slideAnim.setValue(20);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    });
  };

  const handleComplete = () => {
    completeOnboarding(name, email);
    navigation.navigate('Premium');
  };

  const steps = [
    // Step 0: Name
    <View key="name" style={styles.stepContent}>
      <Text style={[styles.emoji]}>👋</Text>
      <Text style={[styles.stepTitle, { color: colors.text }]}>What's your name?</Text>
      <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
        Let's personalize your experience
      </Text>
      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Your first name"
        placeholderTextColor={colors.textTertiary}
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        autoFocus
        returnKeyType="done"
      />
      <Button
        title="Continue"
        onPress={goNext}
        disabled={name.trim().length < 2}
        size="lg"
        style={styles.nextBtn}
      />
    </View>,

    // Step 1: Role
    <View key="role" style={styles.stepContent}>
      <Text style={styles.emoji}>🎯</Text>
      <Text style={[styles.stepTitle, { color: colors.text }]}>I'm a...</Text>
      <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
        We'll customize LifePilot for your lifestyle
      </Text>
      <View style={styles.roleGrid}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.id}
            onPress={() => setRole(r.id)}
            style={[
              styles.roleCard,
              {
                backgroundColor: role === r.id ? colors.accentLight : colors.surface,
                borderColor: role === r.id ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={styles.roleEmoji}>{r.icon}</Text>
            <Text style={[styles.roleLabel, { color: colors.text }]}>{r.label}</Text>
            <Text style={[styles.roleDesc, { color: colors.textSecondary }]}>{r.desc}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Button
        title="Continue"
        onPress={goNext}
        disabled={!role}
        size="lg"
        style={styles.nextBtn}
      />
    </View>,

    // Step 2: Wake time
    <View key="wake" style={styles.stepContent}>
      <Text style={styles.emoji}>⏰</Text>
      <Text style={[styles.stepTitle, { color: colors.text }]}>When do you wake up?</Text>
      <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
        We'll schedule your most important tasks during your peak hours
      </Text>
      <View style={styles.timeGrid}>
        {WAKE_TIMES.map((t) => (
          <TouchableOpacity
            key={t}
            onPress={() => setWakeTime(t)}
            style={[
              styles.timeChip,
              {
                backgroundColor: wakeTime === t ? colors.accent : colors.surface,
                borderColor: wakeTime === t ? colors.accent : colors.border,
              },
            ]}
          >
            <Text style={[styles.timeLabel, { color: wakeTime === t ? '#FFF' : colors.text }]}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <Button
        title="Continue"
        onPress={goNext}
        size="lg"
        style={styles.nextBtn}
      />
    </View>,

    // Step 3: Email
    <View key="email" style={styles.stepContent}>
      <Text style={styles.emoji}>📧</Text>
      <Text style={[styles.stepTitle, { color: colors.text }]}>Your email</Text>
      <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
        For your weekly AI productivity report and syncing across devices
      </Text>
      <TextInput
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor={colors.textTertiary}
        keyboardType="email-address"
        autoCapitalize="none"
        style={[
          styles.input,
          { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
        ]}
        autoFocus
      />
      <View style={[styles.privacyNote, { backgroundColor: colors.accentLight }]}>
        <Ionicons name="lock-closed" size={14} color={colors.accent} />
        <Text style={[styles.privacyText, { color: colors.accent }]}>
          We never share your data. Ever.
        </Text>
      </View>
      <Button
        title="Let's Go! 🚀"
        onPress={handleComplete}
        size="lg"
        style={styles.nextBtn}
      />
      <TouchableOpacity onPress={handleComplete} style={styles.skipBtn}>
        <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip for now</Text>
      </TouchableOpacity>
    </View>,
  ];

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={styles.progressBar}>
        {steps.map((_, i) => (
          <View
            key={i}
            style={[
              styles.progressDot,
              {
                flex: 1,
                backgroundColor: i <= step ? colors.accent : colors.border,
                height: i === step ? 4 : 3,
              },
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          onPress={() => setStep((s) => Math.max(0, s - 1))}
          style={[styles.backBtn, { opacity: step === 0 ? 0 : 1 }]}
        >
          <Ionicons name="arrow-back" size={22} color={colors.text} />
        </TouchableOpacity>

        <Animated.View
          style={[styles.animContainer, { transform: [{ translateY: slideAnim }] }]}
        >
          {steps[step]}
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressBar: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.huge,
    paddingBottom: spacing.md,
  },
  progressDot: {
    borderRadius: 2,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.xxl,
    paddingBottom: spacing.huge,
  },
  backBtn: {
    paddingVertical: spacing.lg,
    alignSelf: 'flex-start',
  },
  animContainer: { flex: 1 },
  stepContent: {
    gap: spacing.xl,
    paddingTop: spacing.lg,
  },
  emoji: {
    fontSize: 48,
    textAlign: 'center',
  },
  stepTitle: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  stepDesc: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  input: {
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 4,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
  },
  roleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  roleCard: {
    width: '47%',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: 6,
    alignItems: 'center',
  },
  roleEmoji: { fontSize: 32 },
  roleLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  roleDesc: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 16,
  },
  timeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  timeChip: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
    borderWidth: 1.5,
  },
  timeLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  privacyText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  nextBtn: { width: '100%' },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  skipText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
});
