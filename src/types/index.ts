export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'missed';
export type TaskCategory = 'work' | 'school' | 'fitness' | 'personal' | 'social' | 'other';
export type InboxItemType = 'screenshot' | 'pdf' | 'email' | 'voice' | 'text';
export type ScheduleBlockType = 'task' | 'break' | 'focus' | 'event' | 'buffer' | 'habit' | 'meal';
export type EnergyLevel = 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  dueDate?: string; // ISO string
  dueTime?: string; // "HH:MM"
  estimatedDuration: number; // minutes
  category: TaskCategory;
  status: TaskStatus;
  createdAt: string;
  completedAt?: string;
  sourceId?: string;
  tags?: string[];
  subtasks?: SubTask[];
  // Smart-scheduling fields (Motion/Reclaim/Morgen inspired)
  energy?: EnergyLevel;        // energy required to do this task
  scheduledStart?: string;     // ISO datetime auto-scheduler placed it
  scheduledEnd?: string;       // ISO datetime
  pinned?: boolean;            // user locked this time, do not auto-move
  autoScheduled?: boolean;     // placed by the AI planner
  splittable?: boolean;        // can be broken into multiple sessions
  minBlock?: number;           // minimum session length when split (minutes)
  notificationId?: string;     // linked scheduled notification
  reminderMinutesBefore?: number;
}

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface ScheduleBlock {
  id: string;
  taskId?: string;
  title: string;
  startTime: string; // "HH:MM"
  endTime: string;
  date: string; // "YYYY-MM-DD"
  type: ScheduleBlockType;
  color?: string;
  completed?: boolean;
  locked?: boolean;       // pinned, planner won't move it
  notificationId?: string;
}

export interface InboxItem {
  id: string;
  type: InboxItemType;
  content: string;
  preview?: string;
  uri?: string;
  extractedTasks?: Partial<Task>[];
  extractedEvents?: Partial<ScheduleBlock>[];
  status: 'pending' | 'processing' | 'processed' | 'failed';
  createdAt: string;
}

export interface UserPreferences {
  wakeTime: string; // "07:00"
  sleepTime: string; // "23:00"
  workStart: string; // "09:00"
  workEnd: string; // "17:00"
  focusDuration: number; // 25 (pomodoro minutes)
  breakDuration: number; // 5
  notifications: boolean;
  dailyReview: boolean;
  weeklyReview: boolean;
  // Smart planner prefs
  bufferMinutes?: number;        // gap between blocks
  autoReschedule?: boolean;      // reactively re-plan on conflict
  voiceEnabled?: boolean;
  voiceName?: string;
  deadlineRiskAlerts?: boolean;  // notify when a task is at risk
  energyCurve?: Record<string, EnergyLevel>; // hour "HH" -> energy level
}

export interface UserStats {
  streak: number;
  longestStreak: number;
  tasksCompletedTotal: number;
  tasksCompletedToday: number;
  tasksCompletedWeek: number;
  productivityScore: number;
  weeklyScores: number[];
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt?: string;
  unlocked: boolean;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  isPremium: boolean;
  premiumExpiry?: string;
  preferences: UserPreferences;
  stats: UserStats;
  achievements: Achievement[];
  onboardingComplete: boolean;
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  tasksCompleted: number;
  tasksMissed: number;
  completionRate: number;
  productivityScore: number;
  topCategory: TaskCategory;
  recommendations: string[];
  highlights: string[];
  areasToImprove: string[];
}

export interface FocusSession {
  id: string;
  taskId: string;
  startedAt: string;
  endedAt?: string;
  duration: number;
  completedPomodoros: number;
}

/* ============================================================
   HABITS / ROUTINES  (Reclaim-inspired self-scheduling habits)
   ============================================================ */
export type HabitFrequency = 'daily' | 'weekly' | 'weekdays' | 'custom';

export interface Habit {
  id: string;
  title: string;
  icon: string;
  color: string;
  frequency: HabitFrequency;
  daysOfWeek?: number[];      // 0-6 when custom/weekly
  durationMinutes: number;
  preferredTime?: string;     // "07:00" ideal window start
  energy?: EnergyLevel;
  streak: number;
  longestStreak: number;
  completedDates: string[];   // "YYYY-MM-DD"
  reminder: boolean;
  reminderMinutesBefore?: number;
  createdAt: string;
}

/* ============================================================
   ALARMS  (Alarmy-inspired smart alarms)
   ============================================================ */
export type AlarmMission = 'none' | 'math' | 'shake' | 'typing';

export interface Alarm {
  id: string;
  label: string;
  time: string;               // "HH:MM"
  daysOfWeek: number[];       // 0-6, empty = one-time
  enabled: boolean;
  sound: string;
  vibrate: boolean;
  snoozeMinutes: number;
  mission: AlarmMission;       // dismiss challenge
  gradualWake: boolean;        // ramp volume
  notificationIds: string[];
  createdAt: string;
}

/* ============================================================
   BILLS / PAYMENTS  (reminders + tracking, NOT money movement)
   ============================================================ */
export type BillStatus = 'upcoming' | 'paid' | 'overdue';
export type BillCadence = 'once' | 'weekly' | 'monthly' | 'yearly';

export interface Bill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  dueDate: string;            // "YYYY-MM-DD"
  cadence: BillCadence;
  category: string;
  status: BillStatus;
  autopay: boolean;           // informational only
  reminderDaysBefore: number;
  notificationId?: string;
  paidDates: string[];
  notes?: string;
  createdAt: string;
}

/* ============================================================
   GENERIC REMINDERS
   ============================================================ */
export interface Reminder {
  id: string;
  title: string;
  notes?: string;
  datetime: string;           // ISO datetime
  repeat: 'none' | 'daily' | 'weekly' | 'monthly';
  completed: boolean;
  notificationId?: string;
  createdAt: string;
}

/* ============================================================
   MEAL PLANNER + GROCERY
   ============================================================ */
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type GroceryCategory =
  | 'produce' | 'meat' | 'dairy' | 'bakery' | 'pantry'
  | 'frozen' | 'beverages' | 'household' | 'other';

export interface Ingredient {
  name: string;
  quantity: string;           // "2 cups", "500 g"
  category: GroceryCategory;
}

export interface Recipe {
  id: string;
  name: string;
  mealType: MealType;
  servings: number;
  prepMinutes: number;
  calories?: number;
  ingredients: Ingredient[];
  steps?: string[];
  tags?: string[];
  emoji?: string;
}

export interface PlannedMeal {
  id: string;
  date: string;               // "YYYY-MM-DD"
  mealType: MealType;
  recipeId?: string;
  customName?: string;
  servings: number;
  notificationId?: string;    // cook reminder
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: string;
  category: GroceryCategory;
  checked: boolean;
  fromRecipeId?: string;
  manual: boolean;
  createdAt: string;
}

export interface PantryItem {
  id: string;
  name: string;
  category: GroceryCategory;
  quantity: string;
  lowStock: boolean;
}

/* ============================================================
   VOICE ASSISTANT
   ============================================================ */
export type AssistantRole = 'user' | 'assistant';

export interface AssistantMessage {
  id: string;
  role: AssistantRole;
  text: string;
  createdAt: string;
  actions?: AssistantAction[];
}

export interface AssistantAction {
  type:
    | 'add_task' | 'complete_task' | 'schedule' | 'add_reminder'
    | 'add_bill' | 'add_grocery' | 'plan_meal' | 'set_alarm'
    | 'plan_day' | 'query' | 'unknown';
  payload?: any;
  label: string;
}

/* ============================================================
   NOTIFICATION LOG  (so users can confirm things "went through")
   ============================================================ */
export interface NotificationRecord {
  id: string;
  notificationId: string;
  kind: 'alarm' | 'reminder' | 'bill' | 'task' | 'habit' | 'meal' | 'deadline';
  title: string;
  body: string;
  fireAt: string;             // ISO datetime
  delivered: boolean;
  sourceId?: string;
}
