import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useStore } from '../store';
import { Button } from '../components/Button';
import { useColors, spacing, radius, fontSize, fontWeight } from '../theme';

export function SettingsScreen({ navigation }: any) {
  const colors = useColors();
  const user = useStore((s) => s.user);
  const updatePreferences = useStore((s) => s.updatePreferences);
  const activatePremium = useStore((s) => s.activatePremium);

  const prefs = user?.preferences;
  const stats = user?.stats;

  const SettingRow = ({
    icon,
    label,
    value,
    onPress,
    toggle,
    toggleValue,
    onToggle,
    subtitle,
    color,
  }: {
    icon: string;
    label: string;
    value?: string;
    onPress?: () => void;
    toggle?: boolean;
    toggleValue?: boolean;
    onToggle?: (v: boolean) => void;
    subtitle?: string;
    color?: string;
  }) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress && !toggle}
      style={[styles.settingRow, { borderBottomColor: colors.border }]}
      activeOpacity={onPress ? 0.6 : 1}
    >
      <View style={[styles.settingIcon, { backgroundColor: (color || colors.accent) + '15' }]}>
        <Ionicons name={icon as any} size={18} color={color || colors.accent} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: colors.textTertiary }]}>{subtitle}</Text>
        )}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.accent }}
          thumbColor="#FFFFFF"
        />
      ) : value ? (
        <Text style={[styles.settingValue, { color: colors.textSecondary }]}>{value}</Text>
      ) : onPress ? (
        <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
      ) : null}
    </TouchableOpacity>
  );

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>{title}</Text>
      <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Profile</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Profile Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.accentLight }]}>
            <Text style={styles.avatarText}>
              {(user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: colors.text }]}>{user?.name || 'User'}</Text>
            <Text style={[styles.profileEmail, { color: colors.textSecondary }]}>
              {user?.email || 'Add email'}
            </Text>
            {user?.isPremium ? (
              <View style={[styles.premiumBadge, { backgroundColor: '#F59E0B20' }]}>
                <Ionicons name="diamond" size={12} color="#F59E0B" />
                <Text style={[styles.premiumBadgeText, { color: '#F59E0B' }]}>Premium</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => navigation.navigate('Premium')}
                style={[styles.upgradeBtn, { backgroundColor: colors.accentLight }]}
              >
                <Ionicons name="diamond-outline" size={12} color={colors.accent} />
                <Text style={[styles.upgradeBtnText, { color: colors.accent }]}>Upgrade to Premium</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Stats */}
        {stats && (
          <View style={styles.statsRow}>
            {[
              { label: 'Tasks Done', value: stats.tasksCompletedTotal },
              { label: 'Day Streak', value: `${stats.streak}🔥` },
              { label: 'Score', value: `${stats.productivityScore}%` },
            ].map((s) => (
              <View key={s.label} style={[styles.statItem, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Weekly Review shortcut */}
        <TouchableOpacity
          onPress={() => navigation.navigate('WeeklyReview')}
          style={styles.reviewBanner}
        >
          <LinearGradient colors={['#4C1D95', '#7C3AED']} style={styles.reviewGradient}>
            <Ionicons name="bar-chart" size={20} color="#FFFFFF" />
            <View style={styles.reviewText}>
              <Text style={styles.reviewTitle}>AI Weekly Review</Text>
              <Text style={styles.reviewSub}>See your progress and recommendations</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color="rgba(255,255,255,0.7)" />
          </LinearGradient>
        </TouchableOpacity>

        {/* Achievements */}
        {user?.achievements && (
          <Section title="ACHIEVEMENTS">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.achievementsRow}>
              {user.achievements.map((ach) => (
                <View
                  key={ach.id}
                  style={[
                    styles.achBadge,
                    {
                      backgroundColor: ach.unlocked ? colors.accentLight : colors.surfaceSecondary,
                      borderColor: ach.unlocked ? colors.accent : colors.border,
                      opacity: ach.unlocked ? 1 : 0.4,
                    },
                  ]}
                >
                  <Text style={styles.achIcon}>{ach.icon}</Text>
                  <Text style={[styles.achTitle, { color: colors.text }]}>{ach.title}</Text>
                  <Text style={[styles.achDesc, { color: colors.textTertiary }]}>{ach.description}</Text>
                </View>
              ))}
            </ScrollView>
          </Section>
        )}

        {/* Schedule Preferences */}
        <Section title="SCHEDULE">
          <SettingRow
            icon="alarm"
            label="Wake Time"
            value={prefs?.wakeTime}
            onPress={() =>
              Alert.prompt('Wake Time', 'Enter wake time (e.g. 07:00)', (v) => {
                if (v) updatePreferences({ wakeTime: v });
              })
            }
          />
          <SettingRow
            icon="moon"
            label="Sleep Time"
            value={prefs?.sleepTime}
            onPress={() =>
              Alert.prompt('Sleep Time', 'Enter sleep time (e.g. 23:00)', (v) => {
                if (v) updatePreferences({ sleepTime: v });
              })
            }
          />
          <SettingRow
            icon="briefcase"
            label="Work Hours"
            value={`${prefs?.workStart} – ${prefs?.workEnd}`}
          />
          <SettingRow
            icon="timer"
            label="Pomodoro Duration"
            value={`${prefs?.focusDuration}min`}
            onPress={() => {
              Alert.alert('Focus Duration', 'Select focus session length', [
                { text: '20 min', onPress: () => updatePreferences({ focusDuration: 20 }) },
                { text: '25 min', onPress: () => updatePreferences({ focusDuration: 25 }) },
                { text: '45 min', onPress: () => updatePreferences({ focusDuration: 45 }) },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          />
          <SettingRow
            icon="cafe"
            label="Break Duration"
            value={`${prefs?.breakDuration}min`}
            onPress={() => {
              Alert.alert('Break Duration', 'Select break length', [
                { text: '5 min', onPress: () => updatePreferences({ breakDuration: 5 }) },
                { text: '10 min', onPress: () => updatePreferences({ breakDuration: 10 }) },
                { text: '15 min', onPress: () => updatePreferences({ breakDuration: 15 }) },
                { text: 'Cancel', style: 'cancel' },
              ]);
            }}
          />
        </Section>

        {/* Notifications */}
        <Section title="NOTIFICATIONS">
          <SettingRow
            icon="notifications"
            label="Push Notifications"
            toggle
            toggleValue={prefs?.notifications}
            onToggle={(v) => updatePreferences({ notifications: v })}
          />
          <SettingRow
            icon="today"
            label="Daily Review"
            subtitle="Morning summary of your day"
            toggle
            toggleValue={prefs?.dailyReview}
            onToggle={(v) => updatePreferences({ dailyReview: v })}
          />
          <SettingRow
            icon="calendar"
            label="Weekly Report"
            subtitle="Every Sunday evening"
            toggle
            toggleValue={prefs?.weeklyReview}
            onToggle={(v) => updatePreferences({ weeklyReview: v })}
          />
        </Section>

        {/* Integrations */}
        <Section title="INTEGRATIONS">
          <SettingRow
            icon="logo-apple"
            label="Apple Calendar"
            subtitle="Sync tasks to Calendar app"
            value={user?.isPremium ? 'Connect' : '⭐ Premium'}
            color="#000000"
            onPress={() => !user?.isPremium && navigation.navigate('Premium')}
          />
          <SettingRow
            icon="logo-google"
            label="Google Calendar"
            subtitle="Sync with Google Calendar"
            value={user?.isPremium ? 'Connect' : '⭐ Premium'}
            color="#4285F4"
            onPress={() => !user?.isPremium && navigation.navigate('Premium')}
          />
        </Section>

        {/* Social */}
        <Section title="COMMUNITY">
          <SettingRow
            icon="people"
            label="Accountability Groups"
            subtitle="Stay accountable with friends"
            value={user?.isPremium ? 'Join' : '⭐ Premium'}
            color="#EC4899"
            onPress={() => !user?.isPremium && navigation.navigate('Premium')}
          />
          <SettingRow
            icon="trophy"
            label="Leaderboard"
            subtitle="Weekly productivity rankings"
            value={user?.isPremium ? 'View' : '⭐ Premium'}
            color="#F59E0B"
            onPress={() => !user?.isPremium && navigation.navigate('Premium')}
          />
        </Section>

        {/* App */}
        <Section title="APP">
          <SettingRow
            icon="star"
            label="Rate LifePilot AI"
            onPress={() => Alert.alert('Thank you!', 'Rating opens App Store in production.')}
          />
          <SettingRow
            icon="share-social"
            label="Share with Friends"
            onPress={() => Alert.alert('Share', 'Sharing opens native share sheet in production.')}
          />
          <SettingRow
            icon="help-circle"
            label="Help & Support"
            onPress={() => Alert.alert('Support', 'Email us at support@lifepilot.ai')}
          />
          <SettingRow
            icon="document-text"
            label="Privacy Policy"
            onPress={() => Alert.alert('Privacy', 'Opens privacy policy in production.')}
          />
        </Section>

        <Text style={[styles.version, { color: colors.textTertiary }]}>LifePilot AI v1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.5,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.huge,
    gap: spacing.lg,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: fontWeight.bold,
    color: '#7C3AED',
  },
  profileInfo: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    letterSpacing: -0.3,
  },
  profileEmail: {
    fontSize: fontSize.sm,
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  premiumBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  upgradeBtnText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  statLabel: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textAlign: 'center',
  },
  reviewBanner: {
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  reviewGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  reviewText: { flex: 1 },
  reviewTitle: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  reviewSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  section: { gap: spacing.sm },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    letterSpacing: 1,
    paddingHorizontal: spacing.md,
  },
  sectionContent: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    minHeight: 56,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: { flex: 1, gap: 2 },
  settingLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
  },
  settingSubtitle: {
    fontSize: fontSize.xs,
  },
  settingValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  achievementsRow: {
    padding: spacing.md,
    marginBottom: -spacing.md,
  },
  achBadge: {
    width: 100,
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    marginRight: spacing.sm,
    gap: 4,
  },
  achIcon: { fontSize: 28, marginBottom: 4 },
  achTitle: {
    fontSize: 12,
    fontWeight: fontWeight.bold,
    textAlign: 'center',
  },
  achDesc: {
    fontSize: 10,
    textAlign: 'center',
    lineHeight: 14,
  },
  version: {
    textAlign: 'center',
    fontSize: fontSize.xs,
    paddingBottom: spacing.md,
  },
});
