import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Task, InboxItem, ScheduleBlock, User, WeeklyReport, UserPreferences, UserStats,
  Habit, Alarm, Bill, Reminder, Recipe, PlannedMeal, GroceryItem, PantryItem,
  AssistantMessage, NotificationRecord, EnergyLevel,
} from '../types';
import { format, addDays } from 'date-fns';
import * as Notif from '../services/notifications';
import { extractTasks, autoSchedule, parseAssistantCommand, parseNaturalLanguage } from '../services/ai';
import * as Blocker from '../services/appBlocker';
import { BlockedApp, FocusBlockSession, BlockSchedule, BlockerSettings } from '../types';

const DEFAULT_PREFERENCES: UserPreferences = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  workStart: '09:00',
  workEnd: '18:00',
  focusDuration: 25,
  breakDuration: 5,
  notifications: true,
  dailyReview: true,
  weeklyReview: true,
  bufferMinutes: 10,
  autoReschedule: true,
  voiceEnabled: true,
  deadlineRiskAlerts: true,
  energyCurve: {
    '06': 'low', '07': 'medium', '08': 'high', '09': 'high', '10': 'high',
    '11': 'high', '12': 'medium', '13': 'low', '14': 'medium', '15': 'high',
    '16': 'medium', '17': 'medium', '18': 'low', '19': 'low', '20': 'low',
  },
};

const DEFAULT_STATS: UserStats = {
  streak: 0, longestStreak: 0, tasksCompletedTotal: 0, tasksCompletedToday: 0,
  tasksCompletedWeek: 0, productivityScore: 0, weeklyScores: [],
};

const today = () => format(new Date(), 'yyyy-MM-dd');
const generateId = () => Math.random().toString(36).slice(2, 11);

const SAMPLE_TASKS: Task[] = [
  { id: '1', title: 'Review quarterly report', description: 'Q3 metrics summary for team meeting', priority: 'urgent', dueDate: today(), dueTime: '14:00', estimatedDuration: 60, category: 'work', status: 'pending', createdAt: new Date().toISOString(), tags: ['report'], energy: 'high' },
  { id: '2', title: 'Complete CS assignment', description: 'Binary tree implementation', priority: 'high', dueDate: today(), dueTime: '23:59', estimatedDuration: 90, category: 'school', status: 'pending', createdAt: new Date().toISOString(), tags: ['coding'], energy: 'high', splittable: true, minBlock: 45 },
  { id: '3', title: 'Morning workout', description: '30-min cardio + strength', priority: 'medium', dueDate: today(), dueTime: '07:30', estimatedDuration: 45, category: 'fitness', status: 'pending', createdAt: new Date().toISOString(), tags: ['health'], energy: 'medium' },
  { id: '4', title: 'Call Mom', description: 'Weekly catch-up', priority: 'low', dueDate: today(), estimatedDuration: 30, category: 'social', status: 'pending', createdAt: new Date().toISOString(), energy: 'low' },
];

const SAMPLE_RECIPES: Recipe[] = [
  { id: 'r1', name: 'Overnight Oats', mealType: 'breakfast', servings: 1, prepMinutes: 5, calories: 350, emoji: '\uD83E\uDD63', ingredients: [ { name: 'Rolled oats', quantity: '1/2 cup', category: 'pantry' }, { name: 'Milk', quantity: '1 cup', category: 'dairy' }, { name: 'Banana', quantity: '1', category: 'produce' }, { name: 'Honey', quantity: '1 tbsp', category: 'pantry' } ], tags: ['quick', 'healthy'] },
  { id: 'r2', name: 'Grilled Chicken Salad', mealType: 'lunch', servings: 2, prepMinutes: 20, calories: 420, emoji: '\uD83E\uDD57', ingredients: [ { name: 'Chicken breast', quantity: '2', category: 'meat' }, { name: 'Mixed greens', quantity: '4 cups', category: 'produce' }, { name: 'Cherry tomatoes', quantity: '1 cup', category: 'produce' }, { name: 'Olive oil', quantity: '2 tbsp', category: 'pantry' }, { name: 'Feta cheese', quantity: '1/2 cup', category: 'dairy' } ], tags: ['high-protein'] },
  { id: 'r3', name: 'Veggie Stir-Fry', mealType: 'dinner', servings: 4, prepMinutes: 30, calories: 480, emoji: '\uD83C\uDF72', ingredients: [ { name: 'Rice', quantity: '2 cups', category: 'pantry' }, { name: 'Bell peppers', quantity: '2', category: 'produce' }, { name: 'Broccoli', quantity: '1 head', category: 'produce' }, { name: 'Soy sauce', quantity: '3 tbsp', category: 'pantry' }, { name: 'Tofu', quantity: '400 g', category: 'produce' } ], tags: ['vegetarian'] },
];

interface AppState {
  user: User | null;
  isOnboardingComplete: boolean;
  tasks: Task[];
  selectedDate: string;
  schedule: ScheduleBlock[];
  inboxItems: InboxItem[];
  isProcessing: boolean;
  weeklyReport: WeeklyReport | null;
  isLoading: boolean;

  // New domains
  habits: Habit[];
  alarms: Alarm[];
  bills: Bill[];
  reminders: Reminder[];
  recipes: Recipe[];
  plannedMeals: PlannedMeal[];
  grocery: GroceryItem[];
  pantry: PantryItem[];
  assistantMessages: AssistantMessage[];
  notificationLog: NotificationRecord[];
  notificationsReady: boolean;

  // Focus / app + game blocker
  blockedApps: BlockedApp[];
  focusBlock: FocusBlockSession | null;
  blockSchedules: BlockSchedule[];
  blockerSettings: BlockerSettings;
  initBlocker: () => Promise<void>;
  requestBlockerAuth: () => Promise<boolean>;
  toggleBlockedApp: (id: string) => void;
  addBlockedApp: (name: string, category: BlockedApp['category']) => void;
  startFocusBlock: (minutes: number, strict: boolean, appIds?: string[]) => Promise<void>;
  endFocusBlock: (force?: boolean) => Promise<boolean>;
  isAppBlockedNow: () => boolean;
  addBlockSchedule: (s: Omit<BlockSchedule, 'id'>) => void;
  toggleBlockSchedule: (id: string) => void;
  deleteBlockSchedule: (id: string) => void;

  // User
  setUser: (user: User) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  completeOnboarding: (name: string, email: string) => void;
  activatePremium: () => void;

  // Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => Task;
  addTaskFromText: (text: string) => Task;
  updateTask: (id: string, updates: Partial<Task>) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setSelectedDate: (date: string) => void;

  // Schedule
  addScheduleBlock: (block: Omit<ScheduleBlock, 'id'>) => void;
  updateScheduleBlock: (id: string, updates: Partial<ScheduleBlock>) => void;
  deleteScheduleBlock: (id: string) => void;
  generateDailySchedule: (date: string) => void;
  autoPlanDay: (date: string) => number;

  // Inbox
  addInboxItem: (item: Omit<InboxItem, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  processInboxItem: (id: string) => Promise<void>;
  deleteInboxItem: (id: string) => void;
  importTasksFromInbox: (inboxId: string) => void;

  // Reports
  generateWeeklyReport: () => void;

  // Notifications
  initNotifications: () => Promise<void>;
  sendTestNotification: () => Promise<void>;

  // Habits
  addHabit: (h: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'longestStreak' | 'completedDates'>) => Promise<void>;
  toggleHabitToday: (id: string) => void;
  deleteHabit: (id: string) => void;

  // Alarms
  addAlarm: (a: Omit<Alarm, 'id' | 'createdAt' | 'notificationIds'>) => Promise<void>;
  toggleAlarm: (id: string) => Promise<void>;
  deleteAlarm: (id: string) => Promise<void>;
  snoozeAlarm: (id: string) => Promise<void>;

  // Bills
  addBill: (b: Omit<Bill, 'id' | 'createdAt' | 'status' | 'paidDates'>) => Promise<void>;
  markBillPaid: (id: string) => void;
  deleteBill: (id: string) => Promise<void>;

  // Reminders
  addReminder: (r: Omit<Reminder, 'id' | 'createdAt' | 'completed'>) => Promise<void>;
  toggleReminder: (id: string) => void;
  deleteReminder: (id: string) => Promise<void>;

  // Meals + Grocery
  addRecipe: (r: Omit<Recipe, 'id'>) => void;
  planMeal: (m: Omit<PlannedMeal, 'id'>) => void;
  removePlannedMeal: (id: string) => void;
  generateGroceryFromMeals: () => number;
  addGroceryItem: (name: string, quantity?: string, category?: GroceryItem['category']) => void;
  toggleGroceryItem: (id: string) => void;
  clearCheckedGrocery: () => void;
  deleteGroceryItem: (id: string) => void;
  addPantryItem: (name: string, category?: PantryItem['category']) => void;
  deletePantryItem: (id: string) => void;

  // Assistant
  sendAssistantMessage: (text: string) => { reply: string };

  // Persistence
  loadData: () => Promise<void>;
  saveData: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isOnboardingComplete: false,
  tasks: SAMPLE_TASKS,
  selectedDate: today(),
  schedule: [],
  inboxItems: [],
  isProcessing: false,
  weeklyReport: null,
  isLoading: true,
  habits: [],
  alarms: [],
  bills: [],
  reminders: [],
  recipes: SAMPLE_RECIPES,
  plannedMeals: [],
  grocery: [],
  pantry: [],
  assistantMessages: [],
  notificationLog: [],
  notificationsReady: false,
  blockedApps: Blocker.DEFAULT_BLOCK_CATALOG.map((a) => ({ ...a, id: generateId(), blocked: false })),
  focusBlock: null,
  blockSchedules: [],
  blockerSettings: { installed: Blocker.isNativeEnforcementAvailable(), authorized: false, platform: Blocker.currentPlatform() },

  setUser: (user) => set({ user }),

  updatePreferences: (prefs) => {
    const { user } = get();
    if (!user) return;
    set({ user: { ...user, preferences: { ...user.preferences, ...prefs } } });
    get().saveData();
  },

  completeOnboarding: (name, email) => {
    const user: User = {
      id: generateId(), name, email, isPremium: false,
      preferences: DEFAULT_PREFERENCES, stats: DEFAULT_STATS,
      achievements: [
        { id: 'first-login', title: 'Welcome!', description: 'Joined LifePilot AI', icon: '\uD83C\uDF89', unlocked: true, unlockedAt: new Date().toISOString() },
        { id: 'streak-3', title: '3-Day Streak', description: 'Productive 3 days in a row', icon: '\uD83D\uDD25', unlocked: false },
        { id: 'streak-7', title: 'Week Warrior', description: '7-day productivity streak', icon: '\u26A1', unlocked: false },
        { id: 'tasks-10', title: 'Task Crusher', description: 'Complete 10 tasks', icon: '\uD83D\uDCAA', unlocked: false },
        { id: 'tasks-100', title: 'Century Club', description: 'Complete 100 tasks', icon: '\uD83C\uDFC6', unlocked: false },
        { id: 'focus-10', title: 'Deep Focus', description: 'Complete 10 Pomodoro sessions', icon: '\uD83C\uDFAF', unlocked: false },
      ],
      onboardingComplete: true,
    };
    set({ user, isOnboardingComplete: true });
    get().initNotifications();
    get().saveData();
  },

  activatePremium: () => {
    const { user } = get();
    if (!user) return;
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + 1);
    set({ user: { ...user, isPremium: true, premiumExpiry: expiry.toISOString() } });
    get().saveData();
  },

  addTask: (taskData) => {
    const task: Task = { ...taskData, id: generateId(), createdAt: new Date().toISOString() };
    set((state) => ({ tasks: [...state.tasks, task] }));
    // Schedule a deadline reminder if the task has a due time.
    if (task.dueDate && task.dueTime && get().user?.preferences.notifications) {
      const [h, m] = task.dueTime.split(':').map(Number);
      const when = new Date(task.dueDate + 'T00:00:00');
      when.setHours(h, m, 0, 0);
      const lead = task.reminderMinutesBefore ?? 30;
      const fireAt = new Date(when.getTime() - lead * 60000);
      Notif.scheduleAt({ title: '\u23F0 ' + task.title, body: 'Coming up in ' + lead + ' min', date: fireAt, channel: 'task', data: { taskId: task.id } })
        .then((nid) => { if (nid) get().updateTask(task.id, { notificationId: nid }); });
    }
    get().saveData();
    return task;
  },

  addTaskFromText: (text) => {
    const intent = parseNaturalLanguage(text);
    return get().addTask({
      title: intent.title, description: text, priority: intent.priority,
      category: intent.category, energy: intent.energy,
      estimatedDuration: intent.estimatedDuration, dueDate: intent.dueDate,
      dueTime: intent.dueTime, status: 'pending', tags: intent.tags,
      splittable: intent.estimatedDuration > 90,
    });
  },

  updateTask: (id, updates) => {
    set((state) => ({ tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)) }));
    get().saveData();
  },

  completeTask: (id) => {
    const { user, tasks } = get();
    const task = tasks.find((t) => t.id === id);
    if (task?.notificationId) Notif.cancel(task.notificationId);
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, status: 'completed', completedAt: new Date().toISOString() } : t)),
    }));
    if (user) {
      const todayTasks = tasks.filter((t) => t.dueDate === today());
      const completedToday = todayTasks.filter((t) => t.status === 'completed').length + 1;
      const score = Math.min(100, Math.round((completedToday / Math.max(todayTasks.length, 1)) * 100));
      set({ user: { ...user, stats: { ...user.stats, tasksCompletedTotal: user.stats.tasksCompletedTotal + 1, tasksCompletedToday: user.stats.tasksCompletedToday + 1, productivityScore: score } } });
    }
    get().saveData();
  },

  deleteTask: (id) => {
    const task = get().tasks.find((t) => t.id === id);
    if (task?.notificationId) Notif.cancel(task.notificationId);
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }));
    get().saveData();
  },

  setSelectedDate: (date) => set({ selectedDate: date }),

  addScheduleBlock: (blockData) => {
    const block: ScheduleBlock = { ...blockData, id: generateId() };
    set((state) => ({ schedule: [...state.schedule, block] }));
    get().saveData();
  },

  updateScheduleBlock: (id, updates) => {
    set((state) => ({ schedule: state.schedule.map((b) => (b.id === id ? { ...b, ...updates } : b)) }));
    get().saveData();
  },

  deleteScheduleBlock: (id) => {
    set((state) => ({ schedule: state.schedule.filter((b) => b.id !== id) }));
    get().saveData();
  },

  generateDailySchedule: (date) => { get().autoPlanDay(date); },

  /**
   * AI auto-planner: places the day's pending tasks into open slots using
   * the priority + deadline + duration + energy formula, around locked
   * events, adding habit blocks. Returns the number of blocks created.
   */
  autoPlanDay: (date) => {
    const { tasks, user, schedule, habits } = get();
    if (!user) return 0;
    const locked = schedule.filter((b) => b.date === date && b.locked);
    const blocks = autoSchedule(tasks, date, {
      workStart: user.preferences.workStart,
      workEnd: user.preferences.workEnd,
      bufferMinutes: user.preferences.bufferMinutes ?? 10,
      energyCurve: user.preferences.energyCurve,
      existingBlocks: locked,
    });
    // Add today's habits as protected blocks.
    const dow = new Date(date + 'T00:00:00').getDay();
    const habitBlocks: ScheduleBlock[] = habits
      .filter((h) => h.frequency === 'daily'
        || (h.frequency === 'weekdays' && dow >= 1 && dow <= 5)
        || (h.frequency === 'weekly' && (h.daysOfWeek || []).includes(dow))
        || (h.frequency === 'custom' && (h.daysOfWeek || []).includes(dow)))
      .map((h) => {
        const start = h.preferredTime || '07:00';
        const [hh, mm] = start.split(':').map(Number);
        const endM = hh * 60 + mm + h.durationMinutes;
        return {
          id: generateId(), title: h.icon + ' ' + h.title, startTime: start,
          endTime: String(Math.floor(endM / 60)).padStart(2, '0') + ':' + String(endM % 60).padStart(2, '0'),
          date, type: 'habit' as const, color: h.color, locked: true,
        };
      });
    const otherDates = schedule.filter((b) => b.date !== date);
    set({ schedule: [...otherDates, ...locked, ...habitBlocks, ...blocks] });
    get().saveData();
    return blocks.length + habitBlocks.length;
  },

  addInboxItem: async (itemData) => {
    const item: InboxItem = { ...itemData, id: generateId(), createdAt: new Date().toISOString(), status: 'pending' };
    set((state) => ({ inboxItems: [item, ...state.inboxItems] }));
    await get().processInboxItem(item.id);
  },

  processInboxItem: async (id) => {
    set({ isProcessing: true });
    set((state) => ({ inboxItems: state.inboxItems.map((i) => (i.id === id ? { ...i, status: 'processing' } : i)) }));
    await new Promise((resolve) => setTimeout(resolve, 1200));
    const item = get().inboxItems.find((i) => i.id === id);
    if (!item) { set({ isProcessing: false }); return; }
    const extractedTasks = extractTasks(item.content, item.type);
    set((state) => ({
      isProcessing: false,
      inboxItems: state.inboxItems.map((i) => (i.id === id ? { ...i, status: 'processed', extractedTasks } : i)),
    }));
    get().saveData();
  },

  deleteInboxItem: (id) => {
    set((state) => ({ inboxItems: state.inboxItems.filter((i) => i.id !== id) }));
    get().saveData();
  },

  importTasksFromInbox: (inboxId) => {
    const item = get().inboxItems.find((i) => i.id === inboxId);
    if (!item?.extractedTasks) return;
    item.extractedTasks.forEach((td) => {
      get().addTask({
        title: td.title || 'Untitled Task', description: td.description || '',
        priority: td.priority || 'medium', dueDate: td.dueDate, dueTime: td.dueTime,
        estimatedDuration: td.estimatedDuration || 30, category: td.category || 'personal',
        status: 'pending', sourceId: inboxId, tags: td.tags, energy: td.energy,
      });
    });
  },

  generateWeeklyReport: () => {
    const { tasks } = get();
    const now = new Date();
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const weekTasks = tasks.filter((t) => new Date(t.createdAt) >= weekStart);
    const completed = weekTasks.filter((t) => t.status === 'completed').length;
    const missed = weekTasks.filter((t) => t.status === 'missed').length;
    const total = weekTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const categoryCount: Record<string, number> = {};
    weekTasks.forEach((t) => { categoryCount[t.category] = (categoryCount[t.category] || 0) + 1; });
    const topCategory = (Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'personal') as any;
    const report: WeeklyReport = {
      weekStart: format(weekStart, 'yyyy-MM-dd'), weekEnd: format(now, 'yyyy-MM-dd'),
      tasksCompleted: completed, tasksMissed: missed, completionRate: rate,
      productivityScore: Math.min(100, rate + completed * 2), topCategory,
      recommendations: rate < 50
        ? ['Break large tasks into 25-min focus sessions', 'Cap your day at 5 priorities']
        : ['Protect your top 3 priorities each morning', 'Keep defending your focus time'],
      highlights: completed > 0 ? ['Completed ' + completed + ' tasks', 'Strongest area: ' + topCategory] : ['Every task counts \u2014 keep going!'],
      areasToImprove: missed > 0 ? [missed + ' tasks missed \u2014 try smaller steps'] : [],
    };
    set({ weeklyReport: report });
    get().saveData();
  },

  initNotifications: async () => {
    try {
      await Notif.initNotifications();
      const granted = await Notif.requestPermissions();
      set({ notificationsReady: granted });
    } catch { set({ notificationsReady: false }); }
  },

  sendTestNotification: async () => {
    await Notif.initNotifications();
    const granted = await Notif.requestPermissions();
    if (granted) await Notif.notifyNow('\u2705 LifePilot notifications are on', 'Alarms, reminders, bills and tasks will now notify you.', 'reminder');
    set({ notificationsReady: granted });
  },

  /* ---------------- HABITS ---------------- */
  addHabit: async (h) => {
    const habit: Habit = { ...h, id: generateId(), createdAt: new Date().toISOString(), streak: 0, longestStreak: 0, completedDates: [] };
    if (habit.reminder && habit.preferredTime && get().notificationsReady) {
      const [hh, mm] = habit.preferredTime.split(':').map(Number);
      const lead = habit.reminderMinutesBefore ?? 0;
      const total = hh * 60 + mm - lead;
      await Notif.scheduleDaily({ title: habit.icon + ' ' + habit.title, body: 'Time for your habit', hour: Math.floor(total / 60), minute: total % 60, channel: 'habit', data: { habitId: habit.id } });
    }
    set((state) => ({ habits: [...state.habits, habit] }));
    get().saveData();
  },

  toggleHabitToday: (id) => {
    const d = today();
    set((state) => ({
      habits: state.habits.map((h) => {
        if (h.id !== id) return h;
        const done = h.completedDates.includes(d);
        const completedDates = done ? h.completedDates.filter((x) => x !== d) : [...h.completedDates, d];
        const streak = done ? Math.max(0, h.streak - 1) : h.streak + 1;
        return { ...h, completedDates, streak, longestStreak: Math.max(h.longestStreak, streak) };
      }),
    }));
    get().saveData();
  },

  deleteHabit: (id) => {
    set((state) => ({ habits: state.habits.filter((h) => h.id !== id) }));
    get().saveData();
  },

  /* ---------------- ALARMS ---------------- */
  addAlarm: async (a) => {
    let notificationIds: string[] = [];
    if (a.enabled && get().notificationsReady) {
      notificationIds = await Notif.scheduleAlarm({ label: a.label, time: a.time, daysOfWeek: a.daysOfWeek, gradualWake: a.gradualWake });
    }
    const alarm: Alarm = { ...a, id: generateId(), createdAt: new Date().toISOString(), notificationIds };
    set((state) => ({ alarms: [...state.alarms, alarm] }));
    get().saveData();
  },

  toggleAlarm: async (id) => {
    const alarm = get().alarms.find((a) => a.id === id);
    if (!alarm) return;
    if (alarm.enabled) {
      await Notif.cancelMany(alarm.notificationIds);
      set((state) => ({ alarms: state.alarms.map((a) => (a.id === id ? { ...a, enabled: false, notificationIds: [] } : a)) }));
    } else {
      const ids = get().notificationsReady ? await Notif.scheduleAlarm({ label: alarm.label, time: alarm.time, daysOfWeek: alarm.daysOfWeek, gradualWake: alarm.gradualWake }) : [];
      set((state) => ({ alarms: state.alarms.map((a) => (a.id === id ? { ...a, enabled: true, notificationIds: ids } : a)) }));
    }
    get().saveData();
  },

  deleteAlarm: async (id) => {
    const alarm = get().alarms.find((a) => a.id === id);
    if (alarm) await Notif.cancelMany(alarm.notificationIds);
    set((state) => ({ alarms: state.alarms.filter((a) => a.id !== id) }));
    get().saveData();
  },

  snoozeAlarm: async (id) => {
    const alarm = get().alarms.find((a) => a.id === id);
    if (!alarm) return;
    await Notif.snooze(alarm.label, alarm.snoozeMinutes || 9, 'alarm');
  },

  /* ---------------- BILLS / PAYMENTS (reminders only) ---------------- */
  addBill: async (b) => {
    let notificationId: string | undefined;
    if (get().notificationsReady) {
      const due = new Date(b.dueDate + 'T09:00:00');
      const fireAt = new Date(due.getTime() - (b.reminderDaysBefore || 1) * 86400000);
      const nid = await Notif.scheduleAt({ title: '\uD83D\uDCB3 ' + b.name + ' due', body: 'Payment of ' + b.currency + b.amount + ' is due ' + b.dueDate, date: fireAt, channel: 'bill', data: { kind: 'bill' } });
      notificationId = nid || undefined;
    }
    const bill: Bill = { ...b, id: generateId(), createdAt: new Date().toISOString(), status: 'upcoming', paidDates: [], notificationId };
    set((state) => ({ bills: [...state.bills, bill] }));
    get().saveData();
  },

  markBillPaid: (id) => {
    set((state) => ({
      bills: state.bills.map((b) => {
        if (b.id !== id) return b;
        const paidDates = [...b.paidDates, today()];
        let next = b;
        if (b.cadence !== 'once') {
          const d = new Date(b.dueDate + 'T00:00:00');
          if (b.cadence === 'weekly') d.setDate(d.getDate() + 7);
          if (b.cadence === 'monthly') d.setMonth(d.getMonth() + 1);
          if (b.cadence === 'yearly') d.setFullYear(d.getFullYear() + 1);
          next = { ...b, paidDates, status: 'upcoming', dueDate: format(d, 'yyyy-MM-dd') };
        } else {
          next = { ...b, paidDates, status: 'paid' };
        }
        return next;
      }),
    }));
    get().saveData();
  },

  deleteBill: async (id) => {
    const bill = get().bills.find((b) => b.id === id);
    if (bill?.notificationId) await Notif.cancel(bill.notificationId);
    set((state) => ({ bills: state.bills.filter((b) => b.id !== id) }));
    get().saveData();
  },

  /* ---------------- REMINDERS ---------------- */
  addReminder: async (r) => {
    let notificationId: string | undefined;
    if (get().notificationsReady) {
      const nid = await Notif.scheduleAt({ title: '\uD83D\uDD14 ' + r.title, body: r.notes || 'Reminder', date: r.datetime, channel: 'reminder', data: { kind: 'reminder' } });
      notificationId = nid || undefined;
    }
    const reminder: Reminder = { ...r, id: generateId(), createdAt: new Date().toISOString(), completed: false, notificationId };
    set((state) => ({ reminders: [reminder, ...state.reminders] }));
    get().saveData();
  },

  toggleReminder: (id) => {
    set((state) => ({ reminders: state.reminders.map((r) => (r.id === id ? { ...r, completed: !r.completed } : r)) }));
    get().saveData();
  },

  deleteReminder: async (id) => {
    const r = get().reminders.find((x) => x.id === id);
    if (r?.notificationId) await Notif.cancel(r.notificationId);
    set((state) => ({ reminders: state.reminders.filter((x) => x.id !== id) }));
    get().saveData();
  },

  /* ---------------- MEALS + GROCERY ---------------- */
  addRecipe: (r) => {
    set((state) => ({ recipes: [...state.recipes, { ...r, id: generateId() }] }));
    get().saveData();
  },

  planMeal: (m) => {
    set((state) => ({ plannedMeals: [...state.plannedMeals, { ...m, id: generateId() }] }));
    get().saveData();
  },

  removePlannedMeal: (id) => {
    set((state) => ({ plannedMeals: state.plannedMeals.filter((m) => m.id !== id) }));
    get().saveData();
  },

  /** Build the grocery list from all planned meals' recipe ingredients,
   *  merging duplicates and skipping items already in the pantry. */
  generateGroceryFromMeals: () => {
    const { plannedMeals, recipes, pantry, grocery } = get();
    const pantryNames = new Set(pantry.map((p) => p.name.toLowerCase()));
    const existing = new Set(grocery.map((g) => g.name.toLowerCase()));
    const additions: GroceryItem[] = [];
    const added = new Set<string>();
    for (const meal of plannedMeals) {
      const recipe = recipes.find((r) => r.id === meal.recipeId);
      if (!recipe) continue;
      for (const ing of recipe.ingredients) {
        const key = ing.name.toLowerCase();
        if (pantryNames.has(key) || existing.has(key) || added.has(key)) continue;
        added.add(key);
        additions.push({ id: generateId(), name: ing.name, quantity: ing.quantity, category: ing.category, checked: false, fromRecipeId: recipe.id, manual: false, createdAt: new Date().toISOString() });
      }
    }
    set((state) => ({ grocery: [...state.grocery, ...additions] }));
    get().saveData();
    return additions.length;
  },

  addGroceryItem: (name, quantity = '1', category = 'other') => {
    set((state) => ({ grocery: [{ id: generateId(), name, quantity, category, checked: false, manual: true, createdAt: new Date().toISOString() }, ...state.grocery] }));
    get().saveData();
  },

  toggleGroceryItem: (id) => {
    set((state) => ({ grocery: state.grocery.map((g) => (g.id === id ? { ...g, checked: !g.checked } : g)) }));
    get().saveData();
  },

  clearCheckedGrocery: () => {
    set((state) => ({ grocery: state.grocery.filter((g) => !g.checked) }));
    get().saveData();
  },

  deleteGroceryItem: (id) => {
    set((state) => ({ grocery: state.grocery.filter((g) => g.id !== id) }));
    get().saveData();
  },

  addPantryItem: (name, category = 'other') => {
    set((state) => ({ pantry: [{ id: generateId(), name, category, quantity: '1', lowStock: false }, ...state.pantry] }));
    get().saveData();
  },

  deletePantryItem: (id) => {
    set((state) => ({ pantry: state.pantry.filter((p) => p.id !== id) }));
    get().saveData();
  },

  /* ---------------- ASSISTANT ---------------- */
  sendAssistantMessage: (text) => {
    const userMsg: AssistantMessage = { id: generateId(), role: 'user', text, createdAt: new Date().toISOString() };
    const { reply, actions } = parseAssistantCommand(text);

    // Execute the parsed action(s).
    for (const action of actions) {
      try {
        if (action.type === 'add_task') {
          const p = action.payload;
          get().addTask({ title: p.title, description: text, priority: p.priority, category: p.category, energy: p.energy, estimatedDuration: p.estimatedDuration, dueDate: p.dueDate, dueTime: p.dueTime, status: 'pending', tags: p.tags });
        } else if (action.type === 'add_reminder') {
          const p = action.payload;
          const dt = new Date();
          if (p.dueTime) { const [h, m] = p.dueTime.split(':').map(Number); dt.setHours(h, m, 0, 0); if (dt.getTime() < Date.now()) dt.setDate(dt.getDate() + 1); }
          else dt.setHours(dt.getHours() + 1);
          get().addReminder({ title: p.title, datetime: dt.toISOString(), repeat: 'none' });
        } else if (action.type === 'plan_day') {
          get().autoPlanDay(today());
        } else if (action.type === 'set_alarm' && action.payload?.time) {
          get().addAlarm({ label: 'Alarm', time: action.payload.time, daysOfWeek: [], enabled: true, sound: 'default', vibrate: true, snoozeMinutes: 9, mission: 'none', gradualWake: false });
        } else if (action.type === 'add_grocery' && action.payload?.name) {
          get().addGroceryItem(action.payload.name);
        } else if (action.type === 'add_bill') {
          const p = action.payload;
          get().addBill({ name: p.title || 'Bill', amount: p.amount || 0, currency: '$', dueDate: p.dueDate || format(addDays(new Date(), 7), 'yyyy-MM-dd'), cadence: 'monthly', category: 'other', autopay: false, reminderDaysBefore: 2 });
        } else if (action.type === 'complete_task' && action.payload?.query) {
          const q = action.payload.query.toLowerCase();
          const match = get().tasks.find((t) => t.status === 'pending' && t.title.toLowerCase().includes(q));
          if (match) get().completeTask(match.id);
        }
      } catch {}
    }

    const assistantMsg: AssistantMessage = { id: generateId(), role: 'assistant', text: reply, createdAt: new Date().toISOString(), actions };
    set((state) => ({ assistantMessages: [...state.assistantMessages, userMsg, assistantMsg] }));
    get().saveData();
    return { reply };
  },

  /* ---------------- FOCUS / APP + GAME BLOCKER ---------------- */
  initBlocker: async () => {
    const installed = Blocker.isNativeEnforcementAvailable();
    const authorized = installed ? await Blocker.isAuthorized() : false;
    set({ blockerSettings: { installed, authorized, platform: Blocker.currentPlatform() } });
  },

  requestBlockerAuth: async () => {
    const ok = await Blocker.requestAuthorization();
    set((state) => ({ blockerSettings: { ...state.blockerSettings, authorized: ok, installed: Blocker.isNativeEnforcementAvailable() } }));
    return ok;
  },

  toggleBlockedApp: (id) => {
    set((state) => ({ blockedApps: state.blockedApps.map((a) => (a.id === id ? { ...a, blocked: !a.blocked } : a)) }));
    get().saveData();
  },

  addBlockedApp: (name, category) => {
    set((state) => ({ blockedApps: [{ id: generateId(), name, category, icon: category === 'game' ? 'game-controller' : 'apps-outline', blocked: true }, ...state.blockedApps] }));
    get().saveData();
  },

  startFocusBlock: async (minutes, strict, appIds) => {
    const ids = appIds && appIds.length ? appIds : get().blockedApps.filter((a) => a.blocked).map((a) => a.id);
    const now = new Date();
    const endsAt = new Date(now.getTime() + minutes * 60000);
    // Attempt real OS-level shield (dev build). Falls back to in-app block otherwise.
    await Blocker.startShield(ids);
    const session: FocusBlockSession = { id: generateId(), startedAt: now.toISOString(), endsAt: endsAt.toISOString(), appIds: ids, strict, active: true };
    set({ focusBlock: session });
    if (get().notificationsReady) {
      Notif.scheduleAt({ title: '\u2705 Focus session complete', body: 'Your apps are unblocked. Nice work staying focused!', date: endsAt, channel: 'reminder' });
    }
    get().saveData();
  },

  endFocusBlock: async (force) => {
    const fb = get().focusBlock;
    if (!fb) return true;
    // Strict mode blocks early exit until the timer is up.
    if (fb.strict && !force && new Date(fb.endsAt).getTime() > Date.now()) return false;
    await Blocker.stopShield();
    set({ focusBlock: null });
    get().saveData();
    return true;
  },

  isAppBlockedNow: () => {
    const { focusBlock, blockSchedules } = get();
    if (focusBlock && focusBlock.active && new Date(focusBlock.endsAt).getTime() > Date.now()) return true;
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const dow = now.getDay();
    return blockSchedules.some((s) => {
      if (!s.enabled || !s.daysOfWeek.includes(dow)) return false;
      const [sh, sm] = s.startTime.split(':').map(Number);
      const [eh, em] = s.endTime.split(':').map(Number);
      return cur >= sh * 60 + sm && cur < eh * 60 + em;
    });
  },

  addBlockSchedule: (s) => {
    set((state) => ({ blockSchedules: [...state.blockSchedules, { ...s, id: generateId() }] }));
    get().saveData();
  },

  toggleBlockSchedule: (id) => {
    set((state) => ({ blockSchedules: state.blockSchedules.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s)) }));
    get().saveData();
  },

  deleteBlockSchedule: (id) => {
    set((state) => ({ blockSchedules: state.blockSchedules.filter((s) => s.id !== id) }));
    get().saveData();
  },

  loadData: async () => {
    try {
      const keys = ['user','tasks','schedule','inbox','weeklyReport','habits','alarms','bills','reminders','recipes','plannedMeals','grocery','pantry','assistant','blockedApps','blockSchedules'];
      const stored = await AsyncStorage.multiGet(keys);
      const map: Record<string, any> = {};
      stored.forEach(([k, v]) => { if (v) try { map[k] = JSON.parse(v); } catch {} });
      set({
        user: map.user || null,
        isOnboardingComplete: map.user ? map.user.onboardingComplete : false,
        tasks: map.tasks || SAMPLE_TASKS,
        schedule: map.schedule || [],
        inboxItems: map.inbox || [],
        weeklyReport: map.weeklyReport || null,
        habits: map.habits || [],
        alarms: map.alarms || [],
        bills: map.bills || [],
        reminders: map.reminders || [],
        recipes: map.recipes || SAMPLE_RECIPES,
        plannedMeals: map.plannedMeals || [],
        grocery: map.grocery || [],
        pantry: map.pantry || [],
        assistantMessages: map.assistant || [],
        blockedApps: map.blockedApps && map.blockedApps.length ? map.blockedApps : get().blockedApps,
        blockSchedules: map.blockSchedules || [],
        isLoading: false,
      });
      if (map.user) get().initNotifications();
      get().initBlocker();
    } catch { set({ isLoading: false }); }
  },

  saveData: async () => {
    const s = get();
    try {
      await AsyncStorage.multiSet([
        ['user', JSON.stringify(s.user)],
        ['tasks', JSON.stringify(s.tasks)],
        ['schedule', JSON.stringify(s.schedule)],
        ['inbox', JSON.stringify(s.inboxItems)],
        ['weeklyReport', JSON.stringify(s.weeklyReport)],
        ['habits', JSON.stringify(s.habits)],
        ['alarms', JSON.stringify(s.alarms)],
        ['bills', JSON.stringify(s.bills)],
        ['reminders', JSON.stringify(s.reminders)],
        ['recipes', JSON.stringify(s.recipes)],
        ['plannedMeals', JSON.stringify(s.plannedMeals)],
        ['grocery', JSON.stringify(s.grocery)],
        ['pantry', JSON.stringify(s.pantry)],
        ['assistant', JSON.stringify(s.assistantMessages)],
        ['blockedApps', JSON.stringify(s.blockedApps)],
        ['blockSchedules', JSON.stringify(s.blockSchedules)],
      ]);
    } catch (e) { console.warn('save failed', e); }
  },
}));
