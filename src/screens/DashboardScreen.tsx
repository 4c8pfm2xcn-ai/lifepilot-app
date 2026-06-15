import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useStore } from '../store';
import { TaskItem } from '../components/TaskItem';
import { ScheduleBlockItem } from '../components/ScheduleBlock';
import { ProgressRing } from '../components/ProgressRing';
import { Card } from '../components/Card';
import { useColors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';

export function DashboardScreen({ navigation }: any) {
  const colors = useColors();
  const user = useStore((s) => s.user);
  const tasks = useStore((s) => s.tasks);
  const schedule = useStore((s) => s.schedule);
  const completeTask = useStore((s) => s.completeTask);
  const [refreshing, setRefreshing] = React.useState(false);

  const today = format(new Date(), 'yyyy-MM-dd');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const todayTasks = useMemo(
    () => tasks.filter((t) => t.dueDate === today && t.status !== 'completed').slice(0, 4),
    [tasks, today]
  );

  const completedToday = useMemo(
    () => tasks.filter((t) => t.dueDate === today && t.status === 'completed').length,
    [tasks, today]
  );

  const totalToday = useMemo(
    () => tasks.filter((t) => t.dueDate === today).length,
    [tasks, today]
  );

  const productivityScore = totalToday > 0 ? Math.round((completedToday / totalToday) * 100) : 0;

  const upcomingBlocks = useMemo(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return schedule
      .filter((b) => b.date === today && b.startTime >= currentTime)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 3);
  }, [schedule, today]);

  const currentBlock = useMemo(() => {
    const now = new Date();
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return schedule.find(
      (b) => b.date === today && b.startTime <= currentTime && b.endTime > currentTime
    );
  }, [schedule, today]);

  const onRefresh = async () => {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              {greeting}, {user?.name?.split(' ')[0] || 'there'} 👋
            </Text>
            <Text style={[styles.date, { color: colors.text }]}>
              {format(new Date(), 'EEEE, MMMM d')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            style={[styles.avatarBtn, { backgroundColor: colors.accentLight }]}
          >
            <Ionicons name="person" size={20} color={colors.accent} />
            {user?.isPremium && (
              <View style={[styles.premiumDot, { backgroundColor: '#F59E0B' }]} />
            )}
          </TouchableOpacity>
        </View>

        {/* Score Hero */}
        <LinearGradient
          colors={['#4C1D95', '#7C3AED']}
          style={styles.heroCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.heroLeft}>
            <Text style={styles.heroTitle}>Today's Score</Text>
            <Text style={styles.heroSubtitle}>
              {completedToday}/{totalToday} tasks complete
            </Text>
            {(user?.stats?.streak ?? 0) > 0 && (
              <View style={styles.streakRow}>
                <Text style={styles.streakEmoji}>🔥</Text>
                <Text style={styles.streakText}>{user?.stats?.streak}-day streak</Text>
              </View>
            )}
          </View>
          <ProgressRing
            progress={productivityScore}
            size={90}
            strokeWidth={8}
            color="#FFFFFF"
          />
        </LinearGradient>

        {/* Current Task */}
        {currentBlock && (
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Block</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Focus', { taskId: currentBlock.taskId })}
              style={[styles.currentTask, { backgroundColor: colors.accentLight, borderColor: colors.accentMuted }]}
              activeOpacity={0.8}
            >
              <View style={[styles.currentTaskIcon, { backgroundColor: colors.accent }]}>
                <Ionicons name="flash" size={20} color="#FFF" />
              </View>
              <View style={styles.currentTaskContent}>
                <Text style={[styles.currentTaskLabel, { color: colors.accent }]}>RIGHT NOW</Text>
                <Text style={[styles.currentTaskTitle, { color: colors.text }]} numberOfLines={1}>
                  {currentBlock.title}
                </Text>
                <Text style={[styles.currentTaskTime, { color: colors.textSecondary }]}>
                  {currentBlock.startTime} – {currentBlock.endTime}
                </Text>
              </View>
              <View style={[styles.focusBtn, { backgroundColor: colors.accent }]}>
                <Ionicons name="play" size={16} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Today's Tasks */}
        {todayTasks.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Today's Tasks</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Tasks')}>
                <Text style={[styles.seeAll, { color: colors.accent }]}>See all</Text>
              </TouchableOpacity>
            </View>
            {todayTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onComplete={() => completeTask(task.id)}
                onPress={() => navigation.navigate('Focus', { taskId: task.id })}
                compact
              />
            ))}
          </View>
        )}

        {todayTasks.length === 0 && completedToday > 0 && (
          <Card style={styles.allDoneCard}>
            <Text style={styles.allDoneEmoji}>🎉</Text>
            <Text style={[styles.allDoneTitle, { color: colors.text }]}>All done for today!</Text>
            <Text style={[styles.allDoneDesc, { color: colors.textSecondary }]}>
              You completed all {completedToday} tasks. Amazing work!
            </Text>
          </Card>
        )}

        {/* Schedule Preview */}
        {upcomingBlocks.length > 0 && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Up Next</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Planner')}>
                <Text style={[styles.seeAll, { color: colors.accent }]}>Full schedule</Text>
              </TouchableOpacity>
            </View>
            {upcomingBlocks.map((block) => (
              <ScheduleBlockItem key={block.id} block={block} />
            ))}
          </View>
        )}

        {/* Quick Actions */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.quickActions}>
            {[
              { icon: 'add-circle', label: 'Add Task', color: colors.accent, nav: 'Tasks' },
              { icon: 'cloud-upload', label: 'Upload', color: '#3B82F6', nav: 'Inbox' },
              { icon: 'flash', label: 'Focus Mode', color: '#F59E0B', nav: 'Focus' },
              { icon: 'calendar', label: 'Planner', color: '#10B981', nav: 'Planner' },
            ].map((action) => (
              <TouchableOpacity
                key={action.label}
                onPress={() => navigation.navigate(action.nav)}
                style={[styles.quickAction, { backgroundColor: action.color + '15', borderColor: action.color + '30' }]}
              >
                <Ionicons name={action.icon as any} size={24} color={action.color} />
                <Text style={[styles.quickActionLabel, { color: action.color }]}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Achievements */}
        {user?.achievements && user !== null && (
          <View>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
                <Text style={[styles.seeAll, { color: colors.accent }]}>View all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsRow}>
              {user.achievements.map((ach) => (
                <View
                  key={ach.id}
                  style={[
                    styles.achievementBadge,
                    {
                      backgroundColor: ach.unlocked ? colors.accentLight : colors.surfaceSecondary,
                      borderColor: ach.unlocked ? colors.accent : colors.border,
                      opacity: ach.unlocked ? 1 : 0.5,
                    },
                  ]}
                >
                  <Text style={styles.achievementIcon}>{ach.icon}</Text>
                  <Text style={[styles.achievementTitle, { color: colors.text }]}>{ach.title}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.lg,
  },
  greeting: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    marginBottom: 2,
  },
  date: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  avatarBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  premiumDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#FFF',
  },
  heroCard: {
    borderRadius: radius.xxl,
    padding: spacing.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: { gap: 6, flex: 1 },
  heroTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.75)',
    fontWeight: fontWeight.medium,
  },
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  streakEmoji: { fontSize: 16 },
  streakText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  seeAll: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    marginBottom: spacing.sm,
  },
  currentTask: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  currentTaskIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currentTaskContent: { flex: 1, gap: 2 },
  currentTaskLabel: {
    fontSize: 10,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
  },
  currentTaskTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  currentTaskTime: {
    fontSize: fontSize.xs,
  },
  focusBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  allDoneCard: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xxl,
  },
  allDoneEmoji: { fontSize: 40 },
  allDoneTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  allDoneDesc: {
    fontSize: fontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  quickActions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickAction: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.xs,
    borderWidth: 1,
  },
  quickActionLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
  achievementsRow: {
    marginHorizontal: -spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  achievementBadge: {
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginRight: spacing.md,
    width: 80,
    gap: spacing.xs,
  },
  achievementIcon: { fontSize: 24 },
  achievementTitle: {
    fontSize: 10,
    fontWeight: fontWeight.semibold,
    textAlign: 'center',
  },
});
