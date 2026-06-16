import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, Alert, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { useColors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';
import * as Voice from '../services/voice';

const SUGGESTIONS = [
  'Plan my day',
  'Remind me to call the dentist at 3pm',
  'Set an alarm for 6:30am',
  'Add milk to my grocery list',
  'Pay $40 phone bill on the 15th',
];

export function AssistantScreen({ navigation }: any) {
  const colors = useColors();
  const messages = useStore((s) => s.assistantMessages);
  const sendAssistantMessage = useStore((s) => s.sendAssistantMessage);
  const voiceEnabled = useStore((s) => s.user?.preferences.voiceEnabled ?? true);

  const [input, setInput] = useState('');
  const [listening, setListening] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  useEffect(() => {
    if (listening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.25, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1, duration: 600, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulse.stopAnimation();
      pulse.setValue(1);
    }
  }, [listening]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setInput('');
    const { reply } = sendAssistantMessage(trimmed);
    if (voiceEnabled) Voice.speak(reply);
  };

  const handleMicPress = async () => {
    if (listening) {
      // stop + transcribe
      setListening(false);
      const { uri } = await Voice.stopListening();
      const transcript = await Voice.transcribe(uri);
      if (transcript) {
        handleSend(transcript);
      } else {
        Alert.alert(
          'Voice captured',
          'On-device transcription needs a dev build. For now, type what you said and I will handle it.',
        );
      }
    } else {
      const ok = await Voice.startListening();
      if (!ok) {
        Alert.alert('Microphone needed', 'Please allow microphone access to talk to your assistant.');
        return;
      }
      setListening(true);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Pilot</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Your voice assistant</Text>
        </View>
        <TouchableOpacity onPress={() => Voice.stopSpeaking()} style={[styles.iconBtn, { backgroundColor: colors.surfaceSecondary }]}>
          <Ionicons name="volume-mute-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView ref={scrollRef} style={styles.thread} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {messages.length === 0 && (
          <View style={styles.empty}>
            <View style={[styles.orb, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="sparkles" size={32} color={colors.accent} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Talk or type to plan your life</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>I can schedule tasks, set alarms and reminders, track bills, and build grocery lists.</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity key={s} style={[styles.chip, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]} onPress={() => handleSend(s)}>
                  <Text style={[styles.chipText, { color: colors.text }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubbleRow, m.role === 'user' ? styles.rowEnd : styles.rowStart]}>
            <View style={[styles.bubble, m.role === 'user' ? { backgroundColor: colors.accent } : { backgroundColor: colors.surfaceSecondary }]}>
              <Text style={[styles.bubbleText, { color: m.role === 'user' ? '#FFF' : colors.text }]}>{m.text}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={[styles.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
            placeholder="Message Pilot..."
            placeholderTextColor={colors.textTertiary}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={() => handleSend(input)}
            returnKeyType="send"
          />
          {input.trim() ? (
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: colors.accent }]} onPress={() => handleSend(input)}>
              <Ionicons name="arrow-up" size={20} color="#FFF" />
            </TouchableOpacity>
          ) : (
            <Animated.View style={{ transform: [{ scale: pulse }] }}>
              <TouchableOpacity style={[styles.micBtn, { backgroundColor: listening ? colors.error : colors.accent }]} onPress={handleMicPress}>
                <Ionicons name={listening ? 'stop' : 'mic'} size={22} color="#FFF" />
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  subtitle: { fontSize: fontSize.sm, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  thread: { flex: 1 },
  empty: { alignItems: 'center', paddingTop: spacing.huge, paddingHorizontal: spacing.lg },
  orb: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, textAlign: 'center' },
  emptyText: { fontSize: fontSize.md, textAlign: 'center', marginTop: spacing.sm, lineHeight: 22 },
  suggestions: { marginTop: spacing.xl, gap: spacing.sm, width: '100%' },
  chip: { borderWidth: 1, borderRadius: radius.full, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, alignItems: 'center' },
  chipText: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  bubbleRow: { marginBottom: spacing.md, flexDirection: 'row' },
  rowEnd: { justifyContent: 'flex-end' },
  rowStart: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', paddingVertical: spacing.md, paddingHorizontal: spacing.lg, borderRadius: radius.xl },
  bubbleText: { fontSize: fontSize.md, lineHeight: 21 },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderTopWidth: 1, gap: spacing.sm },
  input: { flex: 1, height: 44, borderRadius: radius.full, paddingHorizontal: spacing.lg, fontSize: fontSize.md },
  sendBtn: { width: 44, height: 44, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  micBtn: { width: 48, height: 48, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center', ...shadow.md },
});
