import type { CalendarEvent, Conversation, Goal, GoalMilestone, InboxItem, Message, Profile, Task } from "../types";

export interface TableMap {
  tasks: Task;
  events: CalendarEvent;
  inbox_items: InboxItem;
  goals: Goal;
  goal_milestones: GoalMilestone;
  conversations: Conversation;
  messages: Message;
}

export type TableName = keyof TableMap;
export const TABLES: TableName[] = ["tasks", "events", "inbox_items", "goals", "goal_milestones", "conversations", "messages"];

export type Row<T extends TableName> = TableMap[T];

/**
 * Persistence boundary. Every implementation is scoped to a single
 * authenticated user; the Supabase implementation additionally relies on
 * row-level security so a bug here can never expose another user's rows.
 */
export interface DataStore {
  readonly kind: "supabase" | "local";
  readonly userId: string;
  getProfile(): Promise<Profile | null>;
  upsertProfile(profile: Profile): Promise<Profile>;
  list<T extends TableName>(table: T): Promise<Row<T>[]>;
  insert<T extends TableName>(table: T, row: Row<T>): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>;
  remove(table: TableName, id: string): Promise<void>;
  /** Persist an image and return a reference usable with `resolveAttachment`. */
  uploadAttachment(file: Blob, ext: string): Promise<string>;
  resolveAttachment(ref: string): Promise<string | null>;
  removeAttachment(ref: string): Promise<void>;
  /** Permanently delete every row owned by the user (profile is reset, not removed). */
  wipe(): Promise<void>;
}

export class StoreError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "StoreError";
  }
}
