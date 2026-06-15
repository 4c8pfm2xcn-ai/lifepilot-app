import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Vibration,
  AppState,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useStore } from '../store';
import { ProgressRing } from '../components/ProgressRing';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

type Mode = 'focus' | 'break' | 'idle';

export function FocusScreen({ navigation, route }: any) {
  const colors = useColors();
  const tasks = useStore((s) => s.tasks);
  const completeTask = useStore((s) => s.completeTask);
  const user = useStore((s) => s.user);

  const taskId = route?.params?.taskId;
  const currentTask = tasks.find((t) => t.id === taskId) || tasks.find((t) => t.status === 'pending');

  const FOCUS_DURATION = (user?.preferences?.focusDuration || 25) * 60;
  const BREAK_DURATION = (user?.preferences?.breakDuration || 5) * 60;

  const [mode, setMode] = useState<Mode>('idle');
  const [timeLeft, setTimeLeft] = useState(FOCUS_DURATION);
  const [pomodoros, setPomodoros] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalTime = mode === 'break' ? BREAK_DURATION : FOCUS_DURATION;
  const progress = ((totalTime - timeLeft) / totalTime) * 100;

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const tick = useCallback(() => {
    setTimeLeft((prev) => {
      if (prev <= 1) {
        Vibration.vibrate([0, 400, 200, 400]);
        if (mode === 'focus') {
          setPomodoros((p) => p + 1);
          setMode('break');
          setIsRunning(false);
          return BREAK_DURATION;
        } else {
          setMode('focus');
          setIsRunning(false);
          return FOCUS_DURATION;
        }
      }
      return prev - 1;
    });
  }, [mode, FOCUS_DURATION, BREAK_DURATION]);

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning, tick]);

  const handleStart = () => {
    if (mode === 'idle') setMode('focus');
    setIsRunning(true);
  };

  const handlePause = () => setIsRunning(false);

  const handleReset = () => {
    setIsRunning(false);
    setMode('idle');
    setTimeLeft(FOCUS_DURATION);
  };

  const handleSkipBreak = () => {
    setMode('focus');
    setTimeLeft(FOCUS_DURATION);
    setIsRunning(false);
  };

  const gradientColors: [string, string] =
    mode === 'break'
      ? ['#059669', '#10B981']
      : mode === 'focus'
      ? ['#4C1D95', '#7C3AED']
      : ['#1F2937', '#374151'];

  const ringColor = mode === 'break' ? '#34D399' : '#A78BFA';

  const upcomingTasks = tasks
    .filter((t) => t.status === 'pending' && t.id !== currentTask?.id)
    .slice(0, 3);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-down" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Focus Mode</Text>
        <View style={styles.pomodoroCounter}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.pomodoroDot,
                { backgroundColor: i < (pomodoros % 4) ? colors.accent : colors.border },
              ]}
            />
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Timer Hero */}
        <LinearGradient colors={gradientColors} style={styles.timerCard}>
          <Text style={styles.modeLabel}>
            {mode === 'idle' ? 'Ready to focus?' : mode === 'focus' ? '🧠 DEEP FOCUS' : '☕ BREAK TIME'}
          </Text>

          {currentTask && mode !== 'idle' && (
            <Text style={styles.taskLabel} numberOfLines={2}>
              {currentTask.title}
            </Text>
          )}

          <View style={styles.ringWrapper}>
            <ProgressRing
              progress={progress}
              size={200}
              strokeWidth={12}
              color={ringColor}
              showPercentage={false}
            />
            <View style={styles.timeInRing}>
              <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
              <Text style={styles.timerSubtext}>
                {mode === 'break' ? 'Rest & recharge' : 'Stay focused'}
              </Text>
            </View>
          </View>

          <View style={styles.controls}>
            <TouchableOpacity onPress={handleReset} style={styles.sideBtn}>
              <Ionicons name="refresh" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={isRunning ? handlePause : handleStart}
              style={styles.mainBtn}
            >
              <Ionicons name={isRunning ? 'pause' : 'play'} size={32} color="#FFF" />
            </TouchableOpacity>

            {mode === 'break' ? (
              <TouchableOpacity onPress={handleSkipBreak} style={styles.sideBtn}>
                <Ionicons name="play-skip-forward" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => currentTask && completeTask(currentTask.id)}
                style={styles.sideBtn}
              >
                <Ionicons name="checkmark-done" size={22} color="rgba(255,255,255,0.7)" />
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.sessionInfo}>
            <Text style={styles.sessionText}>
              {pomodoros} pomodoro{pomodoros !== 1 ? 's' : ''} completed today
            </Text>
          </View>
        </LinearGradient>

        {/* Current Task Info */}
        {currentTask && (
          <View style={[styles.taskCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.taskCardHeader}>
              <Ionicons name="flash" size={18} color={colors.accent} />
              <Text style={[styles.taskCardTitle, { color: colors.text }]}>Current Task</Text>
            </View>
            <Text style={[styles.taskCardName, { color: colors.text }]}>{currentTask.title}</Text>
            {currentTask.description && (
              <Text style={[styles.taskCardDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                {currentTask.description}
              </Text>
            )}
            <View style={styles.taskCardMeta}>
              <View style={[styles.metaChip, { backgroundColor: colors.accentLight }]}>
                <Ionicons name="time-outline" size={12} color={colors.accent} />
                <Text style={[styles.metaText, { color: colors.accent }]}>
                  {currentTask.estimatedDuration}m estimated
                </Text>
              </View>
              <View style={[styles.metaChip, { backgroundColor: colors.surfaceSecondary }]}>
                <Text style={{ fontSize: 12 }}>
                  {currentTask.priority === 'urgent' ? '🔴' : currentTask.priority === 'high' ? '🟡' : '🔵'}
                </Text>
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                  {currentTask.priority} priority
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={() => completeTask(currentTask.id)}
              style={[styles.doneBtn, { backgroundColor: colors.success }]}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFF" />
              <Text style={styles.doneBtnText}>Mark as Complete</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Tips */}
        <View style={[styles.tipsCard, { backgroundColor: colors.accentLight, borderColor: colors.accentMuted }]}>
          <View style={styles.tipsHeader}>
            <Ionicons name="bulb" size={16} color={colors.accent} />
            <Text style={[styles.tipsTitle, { color: colors.accent }]}>Focus Tips</Text>
          </View>
          {[
            'Put your phone face-down to reduce distractions',
            'Use headphones with ambient sound or lo-fi music',
            'Have a glass of water nearby',
            'Clear your desk before starting',
          ].map((tip, i) => (
            <Text key={i} style={[styles.tip, { color: colors.accent }]}>
              • {tip}
            </Text>
          ))}
        </View>

        {/* Up next */}
        {upcomingTasks.length > 0 && (
          <View>
            <Text style={[styles.upNextLabel, { color: colors.textSecondary }]}>UP NEXT</Text>
            {upcomingTasks.map((task, i) => (
              <TouchableOpacity
                key={task.id}
                onPress={() => navigation.setParams({ taskId: task.id })}
                style={[styles.upNextItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
              >
                <Text style={[styles.upNextNum, { color: colors.textTertiary }]}>{i + 1}</Text>
                <Text style={[styles.upNextTitle, { color: colors.text }]} numberOfLines={1}>
                  {task.title}
                </Text>
                <Text style={[styles.upNextDur, { color: colors.textTertiary }]}>
                  {task.estimatedDuration}m
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  pomodoroCounter: {
    flexDirection: 'row',
    gap: 5,
    alignItems: 'center',
    width: 40,
    justifyContent: 'flex-end',
  },
  pomodoroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  timerCard: {
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    alignItems: 'center',
    gap: spacing.lg,
  },
  modeLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  taskLabel: {
    fontSize: fontSize.md,
    color: '#FFFFFF',
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
  },
  ringWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginVertical: spacing.lg,
  },
  timeInRing: {
    position: 'absolute',
    alignItems: 'center',
  },
  timerText: {
    fontSize: 48,
    fontWeight: fontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  timerSubtext: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: fontWeight.medium,
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxl,
  },
  mainBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    paddingTop: spacing.sm,
  },
  sessionText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  taskCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  taskCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  taskCardTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  taskCardName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  taskCardDesc: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  taskCardMeta: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  metaText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    marginTop: spacing.sm,
  },
  doneBtnText: {
    color: '#FFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  tipsCard: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  tipsTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  tip: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    fontWeight: fontWeight.medium,
  },
  upNextLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  upNextItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  upNextNum: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    width: 20,
    textAlign: 'center',
  },
  upNextTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  upNextDur: {
    fontSize: fontSize.sm,
  },
});
