import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Task, InboxItem, ScheduleBlock, User, WeeklyReport, UserPreferences, UserStats, Priority, TaskCategory } from '../types';
import { format } from 'date-fns';

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
};

const DEFAULT_STATS: UserStats = {
  streak: 0,
  longestStreak: 0,
  tasksCompletedTotal: 0,
  tasksCompletedToday: 0,
  tasksCompletedWeek: 0,
  productivityScore: 0,
  weeklyScores: [],
};

const SAMPLE_TASKS: Task[] = [
  {
    id: '1',
    title: 'Review quarterly report',
    description: 'Go through Q3 performance metrics and prepare summary for team meeting',
    priority: 'urgent',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '14:00',
    estimatedDuration: 60,
    category: 'work',
    status: 'pending',
    createdAt: new Date().toISOString(),
    tags: ['report', 'meeting'],
  },
  {
    id: '2',
    title: 'Complete CS assignment',
    description: 'Finish binary tree implementation and submit before midnight',
    priority: 'high',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '23:59',
    estimatedDuration: 90,
    category: 'school',
    status: 'pending',
    createdAt: new Date().toISOString(),
    tags: ['coding', 'homework'],
  },
  {
    id: '3',
    title: 'Morning workout',
    description: '30-minute cardio + strength training',
    priority: 'medium',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    dueTime: '07:30',
    estimatedDuration: 45,
    category: 'fitness',
    status: 'pending',
    createdAt: new Date().toISOString(),
    tags: ['health'],
  },
  {
    id: '4',
    title: 'Call Mom',
    description: 'Weekly catch-up call',
    priority: 'low',
    dueDate: format(new Date(), 'yyyy-MM-dd'),
    estimatedDuration: 30,
    category: 'social',
    status: 'pending',
    createdAt: new Date().toISOString(),
  },
];

const SAMPLE_SCHEDULE: ScheduleBlock[] = [
  {
    id: 's1',
    title: 'Morning Workout',
    taskId: '3',
    startTime: '07:30',
    endTime: '08:15',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'task',
    color: '#10B981',
  },
  {
    id: 's2',
    title: 'Focus: CS Assignment',
    taskId: '2',
    startTime: '09:00',
    endTime: '10:30',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'focus',
    color: '#7C3AED',
  },
  {
    id: 's3',
    title: 'Break',
    startTime: '10:30',
    endTime: '10:45',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'break',
    color: '#F59E0B',
  },
  {
    id: 's4',
    title: 'Review Quarterly Report',
    taskId: '1',
    startTime: '14:00',
    endTime: '15:00',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'task',
    color: '#3B82F6',
  },
  {
    id: 's5',
    title: 'Call Mom',
    taskId: '4',
    startTime: '18:00',
    endTime: '18:30',
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'task',
    color: '#F59E0B',
  },
];

interface AppState {
  // User
  user: User | null;
  isOnboardingComplete: boolean;

  // Tasks
  tasks: Task[];
  selectedDate: string;

  // Schedule
  schedule: ScheduleBlock[];

  // Inbox
  inboxItems: InboxItem[];
  isProcessing: boolean;

  // Weekly report
  weeklyReport: WeeklyReport | null;

  // UI
  isLoading: boolean;

  // Actions - User
  setUser: (user: User) => void;
  updatePreferences: (prefs: Partial<UserPreferences>) => void;
  completeOnboarding: (name: string, email: string) => void;
  activatePremium: () => void;

  // Actions - Tasks
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  completeTask: (id: string) => void;
  deleteTask: (id: string) => void;
  setSelectedDate: (date: string) => void;

  // Actions - Schedule
  addScheduleBlock: (block: Omit<ScheduleBlock, 'id'>) => void;
  updateScheduleBlock: (id: string, updates: Partial<ScheduleBlock>) => void;
  deleteScheduleBlock: (id: string) => void;
  generateDailySchedule: (date: string) => void;

  // Actions - Inbox
  addInboxItem: (item: Omit<InboxItem, 'id' | 'createdAt' | 'status'>) => Promise<void>;
  processInboxItem: (id: string) => Promise<void>;
  deleteInboxItem: (id: string) => void;
  importTasksFromInbox: (inboxId: string) => void;

  // Actions - Reports
  generateWeeklyReport: () => void;

  // Persistence
  loadData: () => Promise<void>;
  saveData: () => Promise<void>;
}

const generateId = () => Math.random().toString(36).slice(2, 11);

export const useStore = create<AppState>((set, get) => ({
  user: null,
  isOnboardingComplete: false,
  tasks: SAMPLE_TASKS,
  selectedDate: format(new Date(), 'yyyy-MM-dd'),
  schedule: SAMPLE_SCHEDULE,
  inboxItems: [],
  isProcessing: false,
  weeklyReport: null,
  isLoading: true,

  setUser: (user) => set({ user }),

  updatePreferences: (prefs) => {
    const { user } = get();
    if (!user) return;
    const updated = { ...user, preferences: { ...user.preferences, ...prefs } };
    set({ user: updated });
    get().saveData();
  },

  completeOnboarding: (name, email) => {
    const user: User = {
      id: generateId(),
      name,
      email,
      isPremium: false,
      preferences: DEFAULT_PREFERENCES,
      stats: DEFAULT_STATS,
      achievements: [
        { id: 'first-login', title: 'Welcome!', description: 'Joined LifePilot AI', icon: '🎉', unlocked: true, unlockedAt: new Date().toISOString() },
        { id: 'streak-3', title: '3-Day Streak', description: 'Productive 3 days in a row', icon: '🔥', unlocked: false },
        { id: 'streak-7', title: 'Week Warrior', description: '7-day productivity streak', icon: '⚡', unlocked: false },
        { id: 'tasks-10', title: 'Task Crusher', description: 'Complete 10 tasks', icon: '💪', unlocked: false },
        { id: 'tasks-100', title: 'Century Club', description: 'Complete 100 tasks', icon: '🏆', unlocked: false },
        { id: 'focus-10', title: 'Deep Focus', description: 'Complete 10 Pomodoro sessions', icon: '🎯', unlocked: false },
        { id: 'perfect-day', title: 'Perfect Day', description: 'Complete all tasks in a day', icon: '⭐', unlocked: false },
        { id: 'early-bird', title: 'Early Bird', description: 'Start a task before 7am', icon: '🌅', unlocked: false },
      ],
      onboardingComplete: true,
    };
    set({ user, isOnboardingComplete: true });
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
    get().saveData();
  },

  updateTask: (id, updates) => {
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
    get().saveData();
  },

  completeTask: (id) => {
    const { user, tasks } = get();
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, status: 'completed', completedAt: new Date().toISOString() } : t
      ),
    }));
    if (user) {
      const newTotal = user.stats.tasksCompletedTotal + 1;
      const newToday = user.stats.tasksCompletedToday + 1;
      const todayTasks = tasks.filter(t => t.dueDate === format(new Date(), 'yyyy-MM-dd'));
      const completedToday = todayTasks.filter(t => t.status === 'completed').length + 1;
      const score = Math.min(100, Math.round((completedToday / Math.max(todayTasks.length, 1)) * 100));
      set({
        user: {
          ...user,
          stats: {
            ...user.stats,
            tasksCompletedTotal: newTotal,
            tasksCompletedToday: newToday,
            productivityScore: score,
          },
        },
      });
    }
    get().saveData();
  },

  deleteTask: (id) => {
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
    set((state) => ({
      schedule: state.schedule.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
    get().saveData();
  },

  deleteScheduleBlock: (id) => {
    set((state) => ({ schedule: state.schedule.filter((b) => b.id !== id) }));
    get().saveData();
  },

  generateDailySchedule: (date) => {
    const { tasks, user } = get();
    if (!user) return;
    const todayTasks = tasks.filter(
      (t) => t.dueDate === date && t.status === 'pending'
    ).sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    const blocks: ScheduleBlock[] = [];
    const categoryColors: Record<string, string> = {
      work: '#3B82F6',
      school: '#7C3AED',
      fitness: '#10B981',
      personal: '#F59E0B',
      social: '#EC4899',
      other: '#6B7280',
    };

    let currentHour = parseInt(user.preferences.workStart.split(':')[0]);
    todayTasks.forEach((task) => {
      const durationHours = task.estimatedDuration / 60;
      const endHour = currentHour + durationHours;
      blocks.push({
        id: generateId(),
        taskId: task.id,
        title: task.title,
        startTime: `${String(currentHour).padStart(2, '0')}:00`,
        endTime: `${String(Math.floor(endHour)).padStart(2, '0')}:${String(Math.round((endHour % 1) * 60)).padStart(2, '0')}`,
        date,
        type: task.priority === 'urgent' || task.priority === 'high' ? 'focus' : 'task',
        color: categoryColors[task.category] || '#6B7280',
      });
      currentHour = Math.ceil(endHour) + 0.25;
      if (blocks.length % 2 === 0) {
        blocks.push({
          id: generateId(),
          title: 'Break',
          startTime: `${String(Math.floor(currentHour)).padStart(2, '0')}:${String(Math.round((currentHour % 1) * 60)).padStart(2, '0')}`,
          endTime: `${String(Math.floor(currentHour + 0.25)).padStart(2, '0')}:${String(Math.round(((currentHour + 0.25) % 1) * 60)).padStart(2, '0')}`,
          date,
          type: 'break',
          color: '#F59E0B',
        });
        currentHour += 0.25;
      }
    });

    const existingOtherDates = get().schedule.filter((b) => b.date !== date);
    set({ schedule: [...existingOtherDates, ...blocks] });
    get().saveData();
  },

  addInboxItem: async (itemData) => {
    const item: InboxItem = {
      ...itemData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    set((state) => ({ inboxItems: [item, ...state.inboxItems] }));
    await get().processInboxItem(item.id);
  },

  processInboxItem: async (id) => {
    set({ isProcessing: true });
    set((state) => ({
      inboxItems: state.inboxItems.map((i) => (i.id === id ? { ...i, status: 'processing' } : i)),
    }));

    await new Promise((resolve) => setTimeout(resolve, 1500));

    const item = get().inboxItems.find((i) => i.id === id);
    if (!item) return;

    const extractedTasks = extractTasksFromContent(item.content, item.type);

    set((state) => ({
      isProcessing: false,
      inboxItems: state.inboxItems.map((i) =>
        i.id === id ? { ...i, status: 'processed', extractedTasks } : i
      ),
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
    item.extractedTasks.forEach((taskData) => {
      get().addTask({
        title: taskData.title || 'Untitled Task',
        description: taskData.description || '',
        priority: taskData.priority || 'medium',
        dueDate: taskData.dueDate,
        estimatedDuration: taskData.estimatedDuration || 30,
        category: taskData.category || 'personal',
        status: 'pending',
        sourceId: inboxId,
        tags: taskData.tags,
      });
    });
  },

  generateWeeklyReport: () => {
    const { tasks } = get();
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const weekTasks = tasks.filter((t) => {
      const created = new Date(t.createdAt);
      return created >= weekStart;
    });

    const completed = weekTasks.filter((t) => t.status === 'completed').length;
    const missed = weekTasks.filter((t) => t.status === 'missed').length;
    const total = weekTasks.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

    const categoryCount: Record<string, number> = {};
    weekTasks.forEach((t) => {
      categoryCount[t.category] = (categoryCount[t.category] || 0) + 1;
    });
    const topCategory = (Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0]?.[0] || 'personal') as any;

    const report: WeeklyReport = {
      weekStart: format(weekStart, 'yyyy-MM-dd'),
      weekEnd: format(now, 'yyyy-MM-dd'),
      tasksCompleted: completed,
      tasksMissed: missed,
      completionRate: rate,
      productivityScore: Math.min(100, rate + (completed * 2)),
      topCategory,
      recommendations: generateRecommendations(rate, missed, topCategory),
      highlights: completed > 0 ? [`Completed ${completed} tasks this week`, `Your strongest category was ${topCategory}`] : ['Keep going! Every task completed counts.'],
      areasToImprove: missed > 0 ? [`${missed} tasks were missed — try breaking them into smaller steps`, 'Consider adjusting task time estimates'] : [],
    };

    set({ weeklyReport: report });
    get().saveData();
  },

  loadData: async () => {
    try {
      const [userData, tasksData, scheduleData, inboxData, reportData] = await Promise.all([
        AsyncStorage.getItem('user'),
        AsyncStorage.getItem('tasks'),
        AsyncStorage.getItem('schedule'),
        AsyncStorage.getItem('inbox'),
        AsyncStorage.getItem('weeklyReport'),
      ]);

      set({
        user: userData ? JSON.parse(userData) : null,
        isOnboardingComplete: userData ? JSON.parse(userData).onboardingComplete : false,
        tasks: tasksData ? JSON.parse(tasksData) : SAMPLE_TASKS,
        schedule: scheduleData ? JSON.parse(scheduleData) : SAMPLE_SCHEDULE,
        inboxItems: inboxData ? JSON.parse(inboxData) : [],
        weeklyReport: reportData ? JSON.parse(reportData) : null,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  saveData: async () => {
    const { user, tasks, schedule, inboxItems, weeklyReport } = get();
    try {
      await Promise.all([
        user ? AsyncStorage.setItem('user', JSON.stringify(user)) : Promise.resolve(),
        AsyncStorage.setItem('tasks', JSON.stringify(tasks)),
        AsyncStorage.setItem('schedule', JSON.stringify(schedule)),
        AsyncStorage.setItem('inbox', JSON.stringify(inboxItems)),
        weeklyReport ? AsyncStorage.setItem('weeklyReport', JSON.stringify(weeklyReport)) : Promise.resolve(),
      ]);
    } catch (e) {
      console.warn('Failed to save data:', e);
    }
  },
}));

function extractTasksFromContent(content: string, type: InboxItem['type']): Partial<Task>[] {
  const lower = content.toLowerCase();
  const tasks: Partial<Task>[] = [];

  const patterns = [
    { regex: /deadline[:\s]+(.+?)(?:\.|$)/im, field: 'dueDate' },
    { regex: /due[:\s]+(.+?)(?:\.|$)/im, field: 'dueDate' },
    { regex: /submit[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
    { regex: /complete[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
    { regex: /finish[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
    { regex: /assignment[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
    { regex: /meeting[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
    { regex: /call[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
    { regex: /review[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
    { regex: /email[:\s]+(.+?)(?:\.|$)/im, field: 'title' },
  ];

  const sentences = content.split(/[.!?\n]+/).filter(s => s.trim().length > 5);
  sentences.slice(0, 3).forEach((sentence, i) => {
    const priority: Priority = lower.includes('urgent') || lower.includes('asap') || lower.includes('immediately')
      ? 'urgent'
      : lower.includes('important') || lower.includes('critical')
      ? 'high'
      : 'medium';

    const category: TaskCategory = lower.includes('class') || lower.includes('homework') || lower.includes('assignment') || lower.includes('exam')
      ? 'school'
      : lower.includes('meeting') || lower.includes('client') || lower.includes('project') || lower.includes('report')
      ? 'work'
      : lower.includes('workout') || lower.includes('gym') || lower.includes('run')
      ? 'fitness'
      : 'personal';

    if (sentence.trim().length > 10) {
      tasks.push({
        title: sentence.trim().substring(0, 80),
        description: content.substring(0, 200),
        priority,
        category,
        estimatedDuration: 30 + i * 15,
        status: 'pending',
        tags: extractTags(lower),
      });
    }
  });

  return tasks.slice(0, 3);
}

function extractTags(content: string): string[] {
  const tags: string[] = [];
  if (content.includes('meeting')) tags.push('meeting');
  if (content.includes('deadline')) tags.push('deadline');
  if (content.includes('urgent') || content.includes('asap')) tags.push('urgent');
  if (content.includes('homework') || content.includes('assignment')) tags.push('assignment');
  if (content.includes('email')) tags.push('email');
  return tags;
}

function generateRecommendations(rate: number, missed: number, topCategory: string): string[] {
  const recs: string[] = [];
  if (rate < 50) {
    recs.push('Try breaking large tasks into 25-minute Pomodoro sessions');
    recs.push('Set a hard limit of 5 tasks per day to avoid overwhelm');
  } else if (rate < 80) {
    recs.push('You\'re on the right track! Focus on your top 3 priorities each morning');
    recs.push('Block distracting apps during your peak focus hours');
  } else {
    recs.push('Outstanding week! Consider adding a stretch goal next week');
    recs.push('Share your streak with friends to inspire them');
  }
  if (missed > 3) {
    recs.push('Review task estimates — you may be underestimating how long things take');
  }
  recs.push(`Your peak category is ${topCategory} — schedule these tasks during your energy peaks`);
  return recs;
}
