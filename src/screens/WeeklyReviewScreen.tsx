import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import { useStore } from '../store';
import { ProgressRing } from '../components/ProgressRing';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

export function WeeklyReviewScreen({ navigation }: any) {
  const colors = useColors();
  const weeklyReport = useStore((s) => s.weeklyReport);
  const generateWeeklyReport = useStore((s) => s.generateWeeklyReport);
  const user = useStore((s) => s.user);
  const tasks = useStore((s) => s.tasks);

  useEffect(() => {
    if (!weeklyReport) {
      generateWeeklyReport();
    }
  }, []);

  const handleGenerate = () => generateWeeklyReport();

  const handleShare = async () => {
    if (!weeklyReport) return;
    try {
      await Share.share({
        message: `🎯 My LifePilot AI Weekly Report\n\n📊 Productivity Score: ${weeklyReport.productivityScore}%\n✅ Tasks Completed: ${weeklyReport.tasksCompleted}\n📅 Completion Rate: ${weeklyReport.completionRate}%\n🔥 Streak: ${user?.stats.streak || 0} days\n\nTry LifePilot AI to organize your life!`,
      });
    } catch {}
  };

  const categoryStats = tasks.reduce((acc, task) => {
    acc[task.category] = (acc[task.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const CATEGORY_COLORS: Record<string, string> = {
    work: '#3B82F6',
    school: '#7C3AED',
    fitness: '#10B981',
    personal: '#F59E0B',
    social: '#EC4899',
    other: '#6B7280',
  };

  const totalCategoryCount = Object.values(categoryStats).reduce((a, b) => a + b, 0);

  if (!weeklyReport) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.loadingState}>
          <Text style={styles.loadingEmoji}>🤖</Text>
          <Text style={[styles.loadingTitle, { color: colors.text }]}>Generating your report...</Text>
          <Text style={[styles.loadingDesc, { color: colors.textSecondary }]}>
            AI is analyzing your week
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Weekly Review</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {format(new Date(weeklyReport.weekStart), 'MMM d')} – {format(new Date(weeklyReport.weekEnd), 'MMM d, yyyy')}
          </Text>
        </View>
        <TouchableOpacity onPress={handleShare} style={[styles.shareBtn, { backgroundColor: colors.accentLight }]}>
          <Ionicons name="share-outline" size={20} color={colors.accent} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Score Hero */}
        <LinearGradient colors={['#4C1D95', '#7C3AED']} style={styles.heroCard}>
          <View style={styles.heroContent}>
            <View style={styles.heroLeft}>
              <Text style={styles.heroLabel}>PRODUCTIVITY SCORE</Text>
              <Text style={styles.heroScore}>{weeklyReport.productivityScore}</Text>
              <Text style={styles.heroGrade}>
                {weeklyReport.productivityScore >= 80
                  ? '🏆 Excellent'
                  : weeklyReport.productivityScore >= 60
                  ? '⭐ Good'
                  : weeklyReport.productivityScore >= 40
                  ? '💪 Keep Going'
                  : '🌱 Building Habits'}
              </Text>
            </View>
            <ProgressRing
              progress={weeklyReport.productivityScore}
              size={100}
              strokeWidth={10}
              color="#FFFFFF"
            />
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {[
            { label: 'Completed', value: weeklyReport.tasksCompleted, icon: '✅', color: colors.success },
            { label: 'Missed', value: weeklyReport.tasksMissed, icon: '⚠️', color: colors.error },
            { label: 'Rate', value: `${weeklyReport.completionRate}%`, icon: '📊', color: colors.blue },
            { label: 'Streak', value: `${user?.stats.streak || 0}d`, icon: '🔥', color: '#F59E0B' },
          ].map((stat) => (
            <Card key={stat.label} style={styles.statCard}>
              <Text style={styles.statIcon}>{stat.icon}</Text>
              <Text style={[styles.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
            </Card>
          ))}
        </View>

        {/* Category Breakdown */}
        {totalCategoryCount > 0 && (
          <Card>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Category Breakdown</Text>
            <View style={styles.categoryList}>
              {Object.entries(categoryStats)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <View key={cat} style={styles.categoryRow}>
                    <View style={styles.categoryLeft}>
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: CATEGORY_COLORS[cat] || '#6B7280' },
                        ]}
                      />
                      <Text style={[styles.categoryName, { color: colors.text }]}>
                        {cat.charAt(0).toUpperCase() + cat.slice(1)}
                      </Text>
                    </View>
                    <View style={styles.categoryBarWrap}>
                      <View
                        style={[
                          styles.categoryBar,
                          {
                            backgroundColor: CATEGORY_COLORS[cat] || '#6B7280',
                            width: `${(count / totalCategoryCount) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.categoryCount, { color: colors.textSecondary }]}>
                      {count}
                    </Text>
                  </View>
                ))}
            </View>
          </Card>
        )}

        {/* Highlights */}
        {weeklyReport.highlights.length > 0 && (
          <Card style={{ gap: spacing.md }}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="trophy" size={18} color="#F59E0B" />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Highlights</Text>
            </View>
            {weeklyReport.highlights.map((h, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.listBullet, { color: colors.success }]}>✓</Text>
                <Text style={[styles.listText, { color: colors.text }]}>{h}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* Areas to Improve */}
        {weeklyReport.areasToImprove.length > 0 && (
          <Card style={{ gap: spacing.md }}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="trending-up" size={18} color={colors.blue} />
              <Text style={[styles.cardTitle, { color: colors.text, marginBottom: 0 }]}>Growth Areas</Text>
            </View>
            {weeklyReport.areasToImprove.map((area, i) => (
              <View key={i} style={styles.listItem}>
                <Text style={[styles.listBullet, { color: colors.blue }]}>→</Text>
                <Text style={[styles.listText, { color: colors.text }]}>{area}</Text>
              </View>
            ))}
          </Card>
        )}

        {/* AI Recommendations */}
        <Card style={{ backgroundColor: colors.accentLight, borderColor: colors.accentMuted, gap: spacing.md }}>
          <View style={styles.cardHeaderRow}>
            <Ionicons name="sparkles" size={18} color={colors.accent} />
            <Text style={[styles.cardTitle, { color: colors.accent, marginBottom: 0 }]}>AI Recommendations</Text>
          </View>
          {weeklyReport.recommendations.map((rec, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[styles.listBullet, { color: colors.accent }]}>{i + 1}.</Text>
              <Text style={[styles.listText, { color: colors.accent }]}>{rec}</Text>
            </View>
          ))}
        </Card>

        {/* Regenerate */}
        <Button
          title="Regenerate Report"
          onPress={handleGenerate}
          variant="secondary"
          style={{ width: '100%' }}
        />
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
  shareBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  heroCard: {
    borderRadius: radius.xxl,
    padding: spacing.xxl,
  },
  heroContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heroLeft: { gap: spacing.xs },
  heroLabel: {
    fontSize: 11,
    fontWeight: fontWeight.bold,
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 1.5,
  },
  heroScore: {
    fontSize: 56,
    fontWeight: fontWeight.heavy,
    color: '#FFFFFF',
    letterSpacing: -2,
  },
  heroGrade: {
    fontSize: fontSize.md,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: fontWeight.semibold,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  statCard: {
    flex: 1,
    minWidth: '44%',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.md,
  },
  statIcon: { fontSize: 24 },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
  },
  cardTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
    letterSpacing: -0.3,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryList: { gap: spacing.md },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: 80,
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  categoryName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  categoryBarWrap: {
    flex: 1,
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  categoryBar: {
    height: '100%',
    borderRadius: 3,
    minWidth: 4,
  },
  categoryCount: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    width: 20,
    textAlign: 'right',
  },
  listItem: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  listBullet: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    marginTop: 1,
  },
  listText: {
    flex: 1,
    fontSize: fontSize.md,
    lineHeight: 22,
    fontWeight: fontWeight.medium,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  loadingEmoji: { fontSize: 64 },
  loadingTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  loadingDesc: {
    fontSize: fontSize.md,
  },
});
