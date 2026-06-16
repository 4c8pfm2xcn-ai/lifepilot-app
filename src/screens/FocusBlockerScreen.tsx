import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../store';
import { useColors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';

const DURATIONS = [15, 25, 45, 60, 90, 120];

function fmtRemaining(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return (h > 0 ? h + ':' : '') + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

export function FocusBlockerScreen() {
  const colors = useColors();
  const blockedApps = useStore((s) => s.blockedApps);
  const focusBlock = useStore((s) => s.focusBlock);
  const blockerSettings = useStore((s) => s.blockerSettings);
  const toggleBlockedApp = useStore((s) => s.toggleBlockedApp);
  const startFocusBlock = useStore((s) => s.startFocusBlock);
  const endFocusBlock = useStore((s) => s.endFocusBlock);
  const requestBlockerAuth = useStore((s) => s.requestBlockerAuth);
  const initBlocker = useStore((s) => s.initBlocker);

  const [duration, setDuration] = useState(25);
  const [strict, setStrict] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => { initBlocker(); }, []);
  useEffect(() => {
    if (!focusBlock) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [focusBlock]);

  const selectedCount = blockedApps.filter((a) => a.blocked).length;
  const remaining = focusBlock ? new Date(focusBlock.endsAt).getTime() - now : 0;

  const handleStart = async () => {
    if (selectedCount === 0) { Alert.alert('Pick apps first', 'Select at least one app or game to block.'); return; }
    await startFocusBlock(duration, strict);
  };

  const handleEnd = async () => {
    const ok = await endFocusBlock(false);
    if (!ok) {
      Alert.alert('Strict mode is on', 'You committed to this session. You can\'t end it early \u2014 stay strong, the timer will finish on its own.');
    }
  };

  const handleAuth = async () => {
    const ok = await requestBlockerAuth();
    if (!ok) {
      Alert.alert(
        'Full blocking needs setup',
        blockerSettings.platform === 'ios'
          ? 'OS-level blocking uses Apple Screen Time (Family Controls) and requires the LifePilot dev build with Screen Time access. Until then, LifePilot enforces focus inside the app.'
          : blockerSettings.platform === 'android'
          ? 'OS-level blocking uses an Accessibility Service + Usage Access and requires the LifePilot dev build. Until then, LifePilot enforces focus inside the app.'
          : 'OS-level app blocking isn\'t available in this environment. LifePilot enforces focus inside the app.'
      );
    }
  };

  // ----- ACTIVE SESSION VIEW -----
  if (focusBlock && remaining > 0) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.accent }]} edges={['top', 'bottom']}>
        <View style={styles.activeWrap}>
          <Ionicons name="lock-closed" size={48} color="#FFF" />
          <Text style={styles.activeLabel}>Focus mode active</Text>
          <Text style={styles.activeTimer}>{fmtRemaining(remaining)}</Text>
          <Text style={styles.activeSub}>{focusBlock.appIds.length} app{focusBlock.appIds.length === 1 ? '' : 's'} blocked{focusBlock.strict ? ' \u00B7 Strict mode' : ''}</Text>
          <Text style={styles.activeNote}>
            {blockerSettings.installed && blockerSettings.authorized
              ? 'Blocked apps are shielded by your device. Opening them shows a block screen.'
              : 'Stay in the zone. Distracting apps are blocked while LifePilot keeps you accountable.'}
          </Text>
          <TouchableOpacity style={[styles.endBtn, { backgroundColor: focusBlock.strict ? 'rgba(255,255,255,0.25)' : '#FFF' }]} onPress={handleEnd}>
            <Text style={[styles.endText, { color: focusBlock.strict ? '#FFF' : colors.accent }]}>{focusBlock.strict ? 'Locked until timer ends' : 'End session'}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ----- SETUP VIEW -----
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Focus Blocker</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
        <TouchableOpacity
          style={[styles.statusCard, { backgroundColor: blockerSettings.installed && blockerSettings.authorized ? colors.successLight : colors.warningLight }]}
          onPress={handleAuth}
        >
          <Ionicons name={blockerSettings.installed && blockerSettings.authorized ? 'shield-checkmark' : 'shield-outline'} size={22} color={blockerSettings.installed && blockerSettings.authorized ? colors.success : colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.statusTitle, { color: colors.text }]}>
              {blockerSettings.installed && blockerSettings.authorized ? 'Device-level blocking is ON' : 'Tap to enable device-level blocking'}
            </Text>
            <Text style={[styles.statusSub, { color: colors.textSecondary }]}>
              {blockerSettings.installed && blockerSettings.authorized
                ? 'Selected apps are shielded by the OS during focus sessions.'
                : blockerSettings.platform === 'ios'
                ? 'Uses Apple Screen Time. Needs the LifePilot dev build + your authorization.'
                : blockerSettings.platform === 'android'
                ? 'Uses an Accessibility Service. Needs the LifePilot dev build + permissions.'
                : 'Until set up, LifePilot enforces an in-app accountability block.'}
            </Text>
          </View>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>SESSION LENGTH</Text>
        <View style={styles.durations}>
          {DURATIONS.map((d) => (
            <TouchableOpacity key={d} style={[styles.durChip, { borderColor: colors.border }, duration === d && { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => setDuration(d)}>
              <Text style={[styles.durText, { color: duration === d ? '#FFF' : colors.text }]}>{d}m</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.strictRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.strictTitle, { color: colors.text }]}>Strict mode</Text>
            <Text style={[styles.strictSub, { color: colors.textSecondary }]}>Can\'t stop the session early once it starts.</Text>
          </View>
          <Switch value={strict} onValueChange={setStrict} trackColor={{ true: colors.accent }} />
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>BLOCK THESE APPS & GAMES ({selectedCount})</Text>
        {blockedApps.map((app) => (
          <TouchableOpacity key={app.id} style={[styles.appRow, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => toggleBlockedApp(app.id)}>
            <View style={[styles.appIcon, { backgroundColor: app.category === 'game' ? colors.accentLight : colors.surfaceSecondary }]}>
              <Ionicons name={(app.icon as any) || 'apps-outline'} size={20} color={app.blocked ? colors.accent : colors.textTertiary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.appName, { color: colors.text }]}>{app.name}</Text>
              <Text style={[styles.appCat, { color: colors.textTertiary }]}>{app.category}</Text>
            </View>
            <Ionicons name={app.blocked ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={app.blocked ? colors.accent : colors.textTertiary} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <TouchableOpacity style={[styles.startBtn, { backgroundColor: colors.accent }]} onPress={handleStart}>
          <Ionicons name="lock-closed" size={18} color="#FFF" />
          <Text style={styles.startText}>Start {duration}m focus block</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
  activeWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  activeLabel: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.lg, fontWeight: fontWeight.semibold, marginTop: spacing.md },
  activeTimer: { color: '#FFF', fontSize: 64, fontWeight: fontWeight.heavy, letterSpacing: -2 },
  activeSub: { color: 'rgba(255,255,255,0.9)', fontSize: fontSize.md, fontWeight: fontWeight.medium },
  activeNote: { color: 'rgba(255,255,255,0.8)', fontSize: fontSize.sm, textAlign: 'center', lineHeight: 20, marginTop: spacing.sm, paddingHorizontal: spacing.lg },
  endBtn: { marginTop: spacing.xxl, paddingVertical: spacing.lg, paddingHorizontal: spacing.huge, borderRadius: radius.full },
  endText: { fontSize: fontSize.md, fontWeight: fontWeight.bold },
  statusCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: radius.lg, marginBottom: spacing.lg },
  statusTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  statusSub: { fontSize: fontSize.sm, marginTop: 2, lineHeight: 18 },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: fontWeight.bold, letterSpacing: 0.5, marginTop: spacing.lg, marginBottom: spacing.md },
  durations: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  durChip: { paddingVertical: spacing.md, paddingHorizontal: spacing.xl, borderRadius: radius.full, borderWidth: 1 },
  durText: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  strictRow: { flexDirection: 'row', alignItems: 'center', padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, marginTop: spacing.lg },
  strictTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  strictSub: { fontSize: fontSize.sm, marginTop: 2 },
  appRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  appIcon: { width: 38, height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  appName: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  appCat: { fontSize: fontSize.xs, marginTop: 1, textTransform: 'capitalize' },
  footer: { padding: spacing.lg, borderTopWidth: 1, paddingBottom: spacing.xl },
  startBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 54, borderRadius: radius.md, ...shadow.md },
  startText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
