import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Switch, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format, addDays } from 'date-fns';
import { useStore } from '../store';
import { useColors, spacing, radius, fontSize, fontWeight, shadow } from '../theme';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
type TabKey = 'reminders' | 'alarms' | 'bills';

export function RemindersScreen() {
  const colors = useColors();
  const reminders = useStore((s) => s.reminders);
  const alarms = useStore((s) => s.alarms);
  const bills = useStore((s) => s.bills);
  const notificationsReady = useStore((s) => s.notificationsReady);
  const addReminder = useStore((s) => s.addReminder);
  const toggleReminder = useStore((s) => s.toggleReminder);
  const deleteReminder = useStore((s) => s.deleteReminder);
  const addAlarm = useStore((s) => s.addAlarm);
  const toggleAlarm = useStore((s) => s.toggleAlarm);
  const deleteAlarm = useStore((s) => s.deleteAlarm);
  const snoozeAlarm = useStore((s) => s.snoozeAlarm);
  const addBill = useStore((s) => s.addBill);
  const markBillPaid = useStore((s) => s.markBillPaid);
  const deleteBill = useStore((s) => s.deleteBill);
  const sendTestNotification = useStore((s) => s.sendTestNotification);

  const [tab, setTab] = useState<TabKey>('reminders');
  const [modal, setModal] = useState<TabKey | null>(null);
  // form state
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('08:00');
  const [amount, setAmount] = useState('');
  const [days, setDays] = useState<number[]>([]);
  const [gradual, setGradual] = useState(false);

  const resetForm = () => { setTitle(''); setTime('08:00'); setAmount(''); setDays([]); setGradual(false); };
  const openModal = (k: TabKey) => { resetForm(); setModal(k); };

  const toggleDay = (d: number) => setDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);

  const submit = async () => {
    if (!title.trim() && modal !== 'alarms') { Alert.alert('Add a name first'); return; }
    if (modal === 'reminders') {
      const [h, m] = time.split(':').map(Number);
      const dt = new Date(); dt.setHours(h, m, 0, 0);
      if (dt.getTime() < Date.now()) dt.setDate(dt.getDate() + 1);
      await addReminder({ title: title.trim(), datetime: dt.toISOString(), repeat: 'none' });
    } else if (modal === 'alarms') {
      await addAlarm({ label: title.trim() || 'Alarm', time, daysOfWeek: days, enabled: true, sound: 'default', vibrate: true, snoozeMinutes: 9, mission: 'none', gradualWake: gradual });
    } else if (modal === 'bills') {
      await addBill({ name: title.trim(), amount: Number(amount) || 0, currency: '$', dueDate: format(addDays(new Date(), 7), 'yyyy-MM-dd'), cadence: 'monthly', category: 'other', autopay: false, reminderDaysBefore: 2 });
    }
    setModal(null); resetForm();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Reminders</Text>
        <TouchableOpacity style={[styles.addBtn, { backgroundColor: colors.accent }]} onPress={() => openModal(tab)}>
          <Ionicons name="add" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {!notificationsReady && (
        <TouchableOpacity style={[styles.banner, { backgroundColor: colors.warningLight }]} onPress={sendTestNotification}>
          <Ionicons name="notifications-off-outline" size={18} color={colors.warning} />
          <Text style={[styles.bannerText, { color: colors.text }]}>Tap to enable notifications so alarms, reminders & bills actually alert you.</Text>
        </TouchableOpacity>
      )}
      {notificationsReady && (
        <TouchableOpacity style={[styles.banner, { backgroundColor: colors.successLight }]} onPress={sendTestNotification}>
          <Ionicons name="notifications-outline" size={18} color={colors.success} />
          <Text style={[styles.bannerText, { color: colors.text }]}>Notifications are on. Tap to send a test notification.</Text>
        </TouchableOpacity>
      )}

      <View style={[styles.tabs, { backgroundColor: colors.surfaceSecondary }]}>
        {(['reminders', 'alarms', 'bills'] as TabKey[]).map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, tab === t && { backgroundColor: colors.surface, ...shadow.sm }]} onPress={() => setTab(t)}>
            <Text style={[styles.tabText, { color: tab === t ? colors.text : colors.textSecondary }]}>{t[0].toUpperCase() + t.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.huge }}>
        {tab === 'reminders' && (reminders.length === 0
          ? <Empty colors={colors} icon="alarm-outline" text="No reminders yet. Add one and it will notify you." />
          : reminders.map((r) => (
            <View key={r.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <TouchableOpacity onPress={() => toggleReminder(r.id)}>
                <Ionicons name={r.completed ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={r.completed ? colors.success : colors.textTertiary} />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[styles.rowTitle, { color: colors.text, textDecorationLine: r.completed ? 'line-through' : 'none', opacity: r.completed ? 0.5 : 1 }]}>{r.title}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{format(new Date(r.datetime), 'EEE, MMM d \u00B7 h:mm a')}</Text>
              </View>
              <TouchableOpacity onPress={() => deleteReminder(r.id)}><Ionicons name="trash-outline" size={20} color={colors.textTertiary} /></TouchableOpacity>
            </View>
          )))}

        {tab === 'alarms' && (alarms.length === 0
          ? <Empty colors={colors} icon="alarm-outline" text="No alarms set. Add a smart alarm with gradual wake." />
          : alarms.map((a) => (
            <View key={a.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.alarmTime, { color: colors.text, opacity: a.enabled ? 1 : 0.4 }]}>{a.time}</Text>
                <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{a.label}{a.gradualWake ? ' \u00B7 gradual' : ''}{a.daysOfWeek.length ? ' \u00B7 ' + a.daysOfWeek.map((d) => DAYS[d]).join(' ') : ' \u00B7 once'}</Text>
              </View>
              <TouchableOpacity onPress={() => snoozeAlarm(a.id)} style={{ marginRight: spacing.md }}><Ionicons name="time-outline" size={20} color={colors.textTertiary} /></TouchableOpacity>
              <Switch value={a.enabled} onValueChange={() => toggleAlarm(a.id)} trackColor={{ true: colors.accent }} />
              <TouchableOpacity onPress={() => deleteAlarm(a.id)} style={{ marginLeft: spacing.sm }}><Ionicons name="trash-outline" size={20} color={colors.textTertiary} /></TouchableOpacity>
            </View>
          )))}

        {tab === 'bills' && (
          <>
            <View style={[styles.disclaimer, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="information-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={[styles.disclaimerText, { color: colors.textSecondary }]}>LifePilot reminds you about bills and tracks what's paid \u2014 it never moves money. You make payments yourself.</Text>
            </View>
            {bills.length === 0
              ? <Empty colors={colors} icon="card-outline" text="No bills tracked. Add one to get a reminder before it's due." />
              : bills.map((b) => (
                <View key={b.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <View style={[styles.billIcon, { backgroundColor: colors.accentLight }]}>
                    <Ionicons name="receipt-outline" size={18} color={colors.accent} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.rowTitle, { color: colors.text }]}>{b.name}</Text>
                    <Text style={[styles.rowSub, { color: colors.textSecondary }]}>{b.currency}{b.amount} \u00B7 due {format(new Date(b.dueDate + 'T00:00:00'), 'MMM d')} \u00B7 {b.cadence}</Text>
                  </View>
                  <TouchableOpacity style={[styles.payBtn, { backgroundColor: colors.successLight }]} onPress={() => markBillPaid(b.id)}>
                    <Text style={[styles.payText, { color: colors.success }]}>Mark paid</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteBill(b.id)} style={{ marginLeft: spacing.sm }}><Ionicons name="trash-outline" size={20} color={colors.textTertiary} /></TouchableOpacity>
                </View>
              ))}
          </>
        )}
      </ScrollView>

      <Modal visible={!!modal} transparent animationType="slide" onRequestClose={() => setModal(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>New {modal === 'reminders' ? 'reminder' : modal === 'alarms' ? 'alarm' : 'bill'}</Text>
              <TouchableOpacity onPress={() => setModal(null)}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
            </View>

            {modal !== 'alarms' && (
              <TextInput style={[styles.field, { backgroundColor: colors.inputBg, color: colors.text }]} placeholder={modal === 'bills' ? 'Bill name (e.g. Rent)' : 'What should I remind you about?'} placeholderTextColor={colors.textTertiary} value={title} onChangeText={setTitle} />
            )}
            {modal === 'alarms' && (
              <TextInput style={[styles.field, { backgroundColor: colors.inputBg, color: colors.text }]} placeholder="Label (e.g. Wake up)" placeholderTextColor={colors.textTertiary} value={title} onChangeText={setTitle} />
            )}

            {(modal === 'reminders' || modal === 'alarms') && (
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Time (HH:MM)</Text>
                <TextInput style={[styles.timeField, { backgroundColor: colors.inputBg, color: colors.text }]} value={time} onChangeText={setTime} placeholder="08:00" placeholderTextColor={colors.textTertiary} keyboardType="numbers-and-punctuation" />
              </View>
            )}

            {modal === 'alarms' && (
              <>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: spacing.md }]}>Repeat</Text>
                <View style={styles.dayPicker}>
                  {DAYS.map((d, i) => (
                    <TouchableOpacity key={i} style={[styles.dayDot, { borderColor: colors.border }, days.includes(i) && { backgroundColor: colors.accent, borderColor: colors.accent }]} onPress={() => toggleDay(i)}>
                      <Text style={{ color: days.includes(i) ? '#FFF' : colors.textSecondary, fontWeight: '600', fontSize: fontSize.sm }}>{d}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={[styles.switchRow]}>
                  <Text style={[styles.fieldLabel, { color: colors.text }]}>Gradual wake-up</Text>
                  <Switch value={gradual} onValueChange={setGradual} trackColor={{ true: colors.accent }} />
                </View>
              </>
            )}

            {modal === 'bills' && (
              <View style={styles.fieldRow}>
                <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Amount ($)</Text>
                <TextInput style={[styles.timeField, { backgroundColor: colors.inputBg, color: colors.text }]} value={amount} onChangeText={setAmount} placeholder="0" placeholderTextColor={colors.textTertiary} keyboardType="decimal-pad" />
              </View>
            )}

            <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.accent }]} onPress={submit}>
              <Text style={styles.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Empty({ colors, icon, text }: any) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.textTertiary} />
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  title: { fontSize: fontSize.display, fontWeight: fontWeight.bold },
  addBtn: { width: 40, height: 40, borderRadius: radius.full, alignItems: 'center', justifyContent: 'center' },
  banner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginHorizontal: spacing.lg, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.sm },
  bannerText: { flex: 1, fontSize: fontSize.sm },
  tabs: { flexDirection: 'row', marginHorizontal: spacing.lg, borderRadius: radius.md, padding: 4, marginBottom: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm, alignItems: 'center' },
  tabText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, marginBottom: spacing.sm },
  rowTitle: { fontSize: fontSize.md, fontWeight: fontWeight.semibold },
  rowSub: { fontSize: fontSize.sm, marginTop: 2 },
  alarmTime: { fontSize: fontSize.xxl, fontWeight: fontWeight.bold },
  billIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  payBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.full },
  payText: { fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  disclaimer: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md },
  disclaimerText: { flex: 1, fontSize: fontSize.xs, lineHeight: 16 },
  empty: { alignItems: 'center', paddingTop: spacing.huge, gap: spacing.md, paddingHorizontal: spacing.xl },
  emptyText: { fontSize: fontSize.md, textAlign: 'center', lineHeight: 22 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, padding: spacing.lg, paddingBottom: spacing.huge },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  modalTitle: { fontSize: fontSize.xl, fontWeight: fontWeight.bold },
  field: { height: 50, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: fontSize.md, marginBottom: spacing.md },
  fieldRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.md, fontWeight: fontWeight.medium },
  timeField: { width: 110, height: 44, borderRadius: radius.md, paddingHorizontal: spacing.md, fontSize: fontSize.md, textAlign: 'center' },
  dayPicker: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.sm, marginBottom: spacing.md },
  dayDot: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  saveBtn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm },
  saveText: { color: '#FFF', fontSize: fontSize.md, fontWeight: fontWeight.bold },
});
