import { z } from "zod";

/* ── Enumerations ──────────────────────────────────────────────────────── */

export const CATEGORIES = ["personal", "school", "work", "business", "health", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const PRIORITY_RANK: Record<Priority, number> = { urgent: 3, high: 2, normal: 1, low: 0 };

export const CONTENT_TYPES = ["text", "image", "voice", "note", "paste"] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const FOCUS_AREAS = ["school", "work", "business", "personal", "projects", "goals", "everything"] as const;
export type FocusArea = (typeof FOCUS_AREAS)[number];

/* ── Records ───────────────────────────────────────────────────────────── */

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: Category;
  priority: Priority;
  status: "todo" | "done";
  /** ISO timestamp. For date-only deadlines this is 23:59 local and `due_all_day` is true. */
  due_at: string | null;
  due_all_day: boolean;
  estimated_minutes: number | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  goal_id: string | null;
  subtasks: Subtask[];
  source_inbox_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export type ExtractedKind = "task" | "event" | "idea" | "note";

export interface ExtractedItem {
  id: string;
  kind: ExtractedKind;
  title: string;
  description: string | null;
  category: Category;
  priority: Priority;
  estimated_minutes: number | null;
  /** Local calendar date YYYY-MM-DD — only when explicitly stated in the source. */
  date: string | null;
  /** Local time HH:MM — only when explicitly stated. */
  time: string | null;
  end_time: string | null;
  has_deadline: boolean;
  needs_confirmation: boolean;
  ambiguity: string | null;
  status: "pending" | "accepted" | "dismissed";
  /** id of the task/event created from this item */
  created_id?: string | null;
}

export interface Extraction {
  summary: string;
  items: ExtractedItem[];
  source: "ai" | "heuristic" | "manual";
  notice?: string | null;
  processed_at: string;
}

export type InboxStatus = "pending" | "processing" | "needs_review" | "processed" | "failed";

export interface InboxItem {
  id: string;
  user_id: string;
  original_content: string;
  content_type: ContentType;
  attachment_url: string | null;
  extracted_data: Extraction | null;
  processing_status: InboxStatus;
  /** What the user ultimately did with it. */
  resolution: "organized" | "note" | "dismissed" | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  category: Category;
  target_date: string | null; // YYYY-MM-DD
  status: "active" | "completed" | "archived";
  created_at: string;
  updated_at: string;
}

export interface GoalMilestone {
  id: string;
  user_id: string;
  goal_id: string;
  title: string;
  completed: boolean;
  position: number;
  created_at: string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  actions: ProposedAction[];
  source: "ai" | "offline" | null;
  created_at: string;
}

/* ── Preferences ───────────────────────────────────────────────────────── */

export interface Preferences {
  focus_areas: FocusArea[];
  planning_time: "morning" | "evening";
  work_start: string; // HH:MM
  work_end: string; // HH:MM
  daily_focus_minutes: number;
  reminders: "off" | "gentle" | "standard";
  theme: "dark" | "light" | "system";
  week_starts_on: 0 | 1;
  ai_enabled: boolean;
  ai_auto_process: boolean;
  ai_tone: "concise" | "detailed";
  notify_deadlines: boolean;
  notify_events: boolean;
  notify_daily_plan: boolean;
}

export const DEFAULT_PREFERENCES: Preferences = {
  focus_areas: ["everything"],
  planning_time: "morning",
  work_start: "09:00",
  work_end: "17:30",
  daily_focus_minutes: 240,
  reminders: "gentle",
  theme: "dark",
  week_starts_on: 1,
  ai_enabled: true,
  ai_auto_process: true,
  ai_tone: "concise",
  notify_deadlines: true,
  notify_events: true,
  notify_daily_plan: false,
};

export interface Profile {
  id: string;
  full_name: string;
  email: string | null;
  timezone: string;
  preferences: Preferences;
  onboarded: boolean;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

/* ── Assistant actions ─────────────────────────────────────────────────── */

export const ACTION_TYPES = [
  "create_task",
  "update_task",
  "complete_task",
  "delete_task",
  "schedule_task",
  "create_event",
  "add_subtasks",
  "add_milestones",
] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

const hhmm = z.string().regex(/^\d{2}:\d{2}$/);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const ProposedActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("create_task"),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    category: z.enum(CATEGORIES).default("other"),
    priority: z.enum(PRIORITIES).default("normal"),
    due_date: ymd.nullable().optional(),
    due_time: hhmm.nullable().optional(),
    estimated_minutes: z.number().int().min(5).max(960).nullable().optional(),
    goal_id: z.string().nullable().optional(),
  }),
  z.object({
    type: z.literal("update_task"),
    task_id: z.string(),
    title: z.string().min(1).max(200).nullable().optional(),
    priority: z.enum(PRIORITIES).nullable().optional(),
    category: z.enum(CATEGORIES).nullable().optional(),
    due_date: ymd.nullable().optional(),
    due_time: hhmm.nullable().optional(),
    estimated_minutes: z.number().int().min(5).max(960).nullable().optional(),
  }),
  z.object({ type: z.literal("complete_task"), task_id: z.string() }),
  z.object({ type: z.literal("delete_task"), task_id: z.string() }),
  z.object({
    type: z.literal("schedule_task"),
    task_id: z.string(),
    start: z.string(), // ISO
    end: z.string(),
  }),
  z.object({
    type: z.literal("create_event"),
    title: z.string().min(1).max(200),
    description: z.string().max(2000).nullable().optional(),
    start: z.string(),
    end: z.string(),
  }),
  z.object({
    type: z.literal("add_subtasks"),
    task_id: z.string(),
    subtasks: z.array(z.string().min(1).max(200)).min(1).max(12),
  }),
  z.object({
    type: z.literal("add_milestones"),
    goal_id: z.string(),
    milestones: z.array(z.string().min(1).max(200)).min(1).max(12),
  }),
]);

export type ProposedActionPayload = z.infer<typeof ProposedActionSchema>;

export type ProposedAction = ProposedActionPayload & {
  id: string;
  summary: string;
  destructive: boolean;
  warning?: string | null;
  status: "proposed" | "applied" | "dismissed" | "failed";
  error?: string | null;
};

/* ── Planning ──────────────────────────────────────────────────────────── */

export interface PlanBlock {
  task_id: string;
  start: string; // ISO
  end: string; // ISO
  reason: string;
}

export interface DayPlan {
  date: string; // YYYY-MM-DD
  blocks: PlanBlock[];
  unscheduled: { task_id: string; reason: string }[];
  summary: string;
  source: "ai" | "heuristic";
  notice?: string | null;
}

/* ── Snapshot sent to AI routes ────────────────────────────────────────── */

export interface ClientClock {
  /** Local date YYYY-MM-DD on the user's device */
  today: string;
  /** ISO timestamp of "now" */
  now: string;
  timezone: string;
  /** Minutes east of UTC, e.g. -240 for EDT (note: opposite sign of getTimezoneOffset) */
  utc_offset_minutes: number;
}
