export type Priority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'missed';
export type TaskCategory = 'work' | 'school' | 'fitness' | 'personal' | 'social' | 'other';
export type InboxItemType = 'screenshot' | 'pdf' | 'email' | 'voice' | 'text';
export type ScheduleBlockType = 'task' | 'break' | 'focus' | 'event' | 'buffer';

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
