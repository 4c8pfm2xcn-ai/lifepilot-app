import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

/**
 * notifications.ts
 * Central service that makes alarms, reminders, bills, tasks, habits and
 * meal/cook reminders ACTUALLY fire as device notifications.
 *
 * Handles: permission requests, Android channels (incl. a high-priority
 * "alarm" channel), one-time + recurring scheduling, snooze, and cancel.
 *
 * Note: Full lock-screen "alarm clock" behaviour that overrides silent mode
 * (Alarmy-style) requires a custom dev build with native config. Inside
 * Expo Go this delivers high-priority notifications with sound + vibration.
 */

// Foreground behaviour: show alert + play sound even when app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const CHANNELS = {
  alarm: 'alarms',
  reminder: 'reminders',
  bill: 'bills',
  task: 'tasks',
  habit: 'habits',
  meal: 'meals',
};

let initialized = false;

export async function initNotifications(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNELS.alarm, {
      name: 'Alarms',
      importance: Notifications.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 400, 250, 400, 250, 400],
      bypassDnd: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.reminder, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.bill, {
      name: 'Bills & Payments',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.task, {
      name: 'Tasks',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.habit, {
      name: 'Habits & Routines',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(CHANNELS.meal, {
      name: 'Meals',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  initialized = true;
  return true;
}

export async function requestPermissions(): Promise<boolean> {
  if (!initialized) await initNotifications();
  const settings = await Notifications.getPermissionsAsync();
  let granted = settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  if (!granted) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: true, allowCriticalAlerts: true },
    });
    granted = req.granted || req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }
  return !!granted;
}

export async function hasPermissions(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  return !!(settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL);
}

function toDate(input: string | Date): Date {
  return input instanceof Date ? input : new Date(input);
}

/** Schedule a one-time notification at an absolute datetime. */
export async function scheduleAt(opts: {
  title: string;
  body: string;
  date: string | Date;
  channel?: keyof typeof CHANNELS;
  data?: Record<string, any>;
  sound?: boolean;
}): Promise<string | null> {
  const fireDate = toDate(opts.date);
  if (fireDate.getTime() <= Date.now()) return null; // never schedule in the past
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title,
      body: opts.body,
      sound: opts.sound === false ? undefined : 'default',
      data: opts.data || {},
      ...(Platform.OS === 'android' ? { channelId: CHANNELS[opts.channel || 'reminder'] } : {}),
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireDate },
  });
  return id;
}

/** Schedule a daily-repeating notification at a given hour/minute. */
export async function scheduleDaily(opts: {
  title: string; body: string; hour: number; minute: number;
  channel?: keyof typeof CHANNELS; data?: Record<string, any>;
}): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title, body: opts.body, sound: 'default', data: opts.data || {},
      ...(Platform.OS === 'android' ? { channelId: CHANNELS[opts.channel || 'reminder'] } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: opts.hour, minute: opts.minute,
    },
  });
}

/** Schedule a weekly-repeating notification. weekday: 1=Sun..7=Sat (expo). */
export async function scheduleWeekly(opts: {
  title: string; body: string; weekday: number; hour: number; minute: number;
  channel?: keyof typeof CHANNELS; data?: Record<string, any>;
}): Promise<string> {
  return Notifications.scheduleNotificationAsync({
    content: {
      title: opts.title, body: opts.body, sound: 'default', data: opts.data || {},
      ...(Platform.OS === 'android' ? { channelId: CHANNELS[opts.channel || 'reminder'] } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: opts.weekday, hour: opts.hour, minute: opts.minute,
    },
  });
}

/**
 * Schedule a recurring alarm across selected weekdays.
 * daysOfWeek: 0=Sun..6=Sat (app convention). Empty = one-time next occurrence.
 * Returns an array of notification ids (one per active day).
 */
export async function scheduleAlarm(opts: {
  label: string; time: string; daysOfWeek: number[];
  gradualWake?: boolean; data?: Record<string, any>;
}): Promise<string[]> {
  const [h, m] = opts.time.split(':').map(Number);
  const ids: string[] = [];
  const body = opts.gradualWake ? 'Gentle wake-up — rise and shine' : 'Time to wake up!';
  if (!opts.daysOfWeek || opts.daysOfWeek.length === 0) {
    const next = new Date();
    next.setHours(h, m, 0, 0);
    if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);
    const id = await scheduleAt({ title: '⏰ ' + opts.label, body, date: next, channel: 'alarm', data: { kind: 'alarm', ...opts.data } });
    if (id) ids.push(id);
  } else {
    for (const day of opts.daysOfWeek) {
      const id = await scheduleWeekly({
        title: '⏰ ' + opts.label, body, weekday: day + 1, hour: h, minute: m,
        channel: 'alarm', data: { kind: 'alarm', ...opts.data },
      });
      ids.push(id);
    }
  }
  return ids;
}

/** Snooze: re-fire an alarm/reminder N minutes from now. */
export async function snooze(title: string, minutes: number, channel: keyof typeof CHANNELS = 'alarm'): Promise<string | null> {
  const when = new Date(Date.now() + minutes * 60 * 1000);
  return scheduleAt({ title: '⏰ ' + title + ' (snoozed)', body: 'Snooze is over!', date: when, channel });
}

export async function cancel(id?: string | null): Promise<void> {
  if (!id) return;
  try { await Notifications.cancelScheduledNotificationAsync(id); } catch {}
}

export async function cancelMany(ids?: string[] | null): Promise<void> {
  if (!ids) return;
  await Promise.all(ids.map((i) => cancel(i)));
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function listScheduled(): Promise<Notifications.NotificationRequest[]> {
  return Notifications.getAllScheduledNotificationsAsync();
}

/** Fire an immediate local notification (used to confirm things "went through"). */
export async function notifyNow(title: string, body: string, channel: keyof typeof CHANNELS = 'reminder'): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title, body, sound: 'default',
      ...(Platform.OS === 'android' ? { channelId: CHANNELS[channel] } : {}),
    },
    trigger: null,
  });
}

export { Notifications };
