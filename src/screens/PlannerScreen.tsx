import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays, subDays, startOfWeek, isSameDay, parseISO } from 'date-fns';
import { useStore } from '../store';
import { ScheduleBlockItem } from '../components/ScheduleBlock';
import { Button } from '../components/Button';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

export function PlannerScreen({ navigation }: any) {
  const colors = useColors();
  const schedule = useStore((s) => s.schedule);
  const tasks = useStore((s) => s.tasks);
  const generateDailySchedule = useStore((s) => s.generateDailySchedule);
  const updateScheduleBlock = useStore((s) => s.updateScheduleBlock);

  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  const dayBlocks = useMemo(
    () =>
      schedule
        .filter((b) => b.date === selectedDateStr)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [schedule, selectedDateStr]
  );

  const dayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === selectedDateStr),
    [tasks, selectedDateStr]
  );

  const handleGenerate = () => {
    Alert.alert(
      'Generate Schedule',
      'AI will create an optimized schedule for this day based on your tasks and priorities.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Generate',
          onPress: () => generateDailySchedule(selectedDateStr),
        },
      ]
    );
  };

  const handleCompleteBlock = (blockId: string) => {
    updateScheduleBlock(blockId, { completed: true });
  };

  const isToday = isSameDay(selectedDate, new Date());

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Planner</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {format(selectedDate, 'MMMM yyyy')}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleGenerate}
            style={[styles.aiBtn, { backgroundColor: colors.accentLight }]}
          >
            <Ionicons name="sparkles" size={16} color={colors.accent} />
            <Text style={[styles.aiBtnText, { color: colors.accent }]}>AI Schedule</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Week Strip */}
      <View style={styles.weekStrip}>
        <TouchableOpacity onPress={() => setSelectedDate(subDays(selectedDate, 7))}>
          <Ionicons name="chevron-back" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.daysScroll}>
          {weekDays.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const isSelected = isSameDay(day, selectedDate);
            const isDayToday = isSameDay(day, new Date());
            const hasTasks = tasks.some((t) => t.dueDate === dayStr);
            return (
              <TouchableOpacity
                key={dayStr}
                onPress={() => setSelectedDate(day)}
                style={[
                  styles.dayChip,
                  {
                    backgroundColor: isSelected ? colors.accent : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.dayName,
                    { color: isSelected ? 'rgba(255,255,255,0.75)' : colors.textSecondary },
                  ]}
                >
                  {format(day, 'EEE')}
                </Text>
                <Text
                  style={[
                    styles.dayNum,
                    { color: isSelected ? '#FFF' : isDayToday ? colors.accent : colors.text },
                  ]}
                >
                  {format(day, 'd')}
                </Text>
                {hasTasks && !isSelected && (
                  <View style={[styles.taskDot, { backgroundColor: colors.accent }]} />
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <TouchableOpacity onPress={() => setSelectedDate(addDays(selectedDate, 7))}>
          <Ionicons name="chevron-forward" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Day Summary */}
        <View style={styles.daySummary}>
          <Text style={[styles.dayLabel, { color: colors.text }]}>
            {isToday ? 'Today' : format(selectedDate, 'EEEE, MMMM d')}
          </Text>
          <View style={styles.daySummaryStats}>
            <View style={[styles.statChip, { backgroundColor: colors.accentLight }]}>
              <Ionicons name="checkbox" size={12} color={colors.accent} />
              <Text style={[styles.statText, { color: colors.accent }]}>
                {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
              </Text>
            </View>
            <View style={[styles.statChip, { backgroundColor: colors.blueLight }]}>
              <Ionicons name="time" size={12} color={colors.blue} />
              <Text style={[styles.statText, { color: colors.blue }]}>
                {dayTasks.reduce((sum, t) => sum + t.estimatedDuration, 0)}m scheduled
              </Text>
            </View>
          </View>
        </View>

        {dayBlocks.length === 0 && dayTasks.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📅</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Nothing scheduled</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
              Tap "AI Schedule" to automatically build an optimized day plan from your tasks.
            </Text>
            <Button
              title="Generate AI Schedule"
              onPress={handleGenerate}
              variant="secondary"
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <>
            {dayBlocks.length > 0 && (
              <View>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SCHEDULE</Text>
                {dayBlocks.map((block) => (
                  <ScheduleBlockItem
                    key={block.id}
                    block={block}
                    onComplete={() => handleCompleteBlock(block.id)}
                    onPress={() => {
                      if (block.taskId) {
                        navigation.navigate('Focus', { taskId: block.taskId });
                      }
                    }}
                  />
                ))}
              </View>
            )}

            {dayTasks.length > 0 && (
              <View>
                <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>TASKS DUE</Text>
                {dayTasks.map((task) => (
                  <TouchableOpacity
                    key={task.id}
                    onPress={() => navigation.navigate('Tasks')}
                    style={[
                      styles.taskPill,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.taskPillDot,
                        {
                          backgroundColor:
                            task.priority === 'urgent'
                              ? '#EF4444'
                              : task.priority === 'high'
                              ? '#F59E0B'
                              : '#3B82F6',
                        },
                      ]}
                    />
                    <Text style={[styles.taskPillTitle, { color: colors.text }]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    <Text style={[styles.taskPillTime, { color: colors.textTertiary }]}>
                      {task.estimatedDuration}m
                    </Text>
                    {task.status === 'completed' && (
                      <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
  },
  aiBtnText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  weekStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  daysScroll: {
    flex: 1,
  },
  dayChip: {
    width: 44,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    marginHorizontal: 2,
    gap: 4,
  },
  dayName: {
    fontSize: 11,
    fontWeight: fontWeight.medium,
  },
  dayNum: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  taskDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.xxl,
  },
  daySummary: {
    gap: spacing.sm,
  },
  dayLabel: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  daySummaryStats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  statChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  statText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: spacing.huge,
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  emptyEmoji: { fontSize: 56 },
  emptyTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  emptyDesc: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  taskPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  taskPillDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  taskPillTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  taskPillTime: {
    fontSize: fontSize.sm,
  },
});
