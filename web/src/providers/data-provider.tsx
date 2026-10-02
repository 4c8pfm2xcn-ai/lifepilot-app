"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/config";
import { LocalStore } from "@/lib/data/local-store";
import { SupabaseStore } from "@/lib/data/supabase-store";
import { StoreError, TABLES, type DataStore, type Row, type TableName } from "@/lib/data/store";
import { uid } from "@/lib/id";
import { localTimeZone } from "@/lib/time";
import {
  DEFAULT_PREFERENCES,
  type CalendarEvent,
  type Conversation,
  type Goal,
  type GoalMilestone,
  type InboxItem,
  type Message,
  type Preferences,
  type Profile,
  type Task,
} from "@/lib/types";
import { useToast } from "@/components/ui/toast";
import { useThemeSync } from "./theme";
import type { AuthUser } from "@/lib/auth/auth-client";

type Collections = { [K in TableName]: Row<K>[] };

const EMPTY: Collections = { tasks: [], events: [], inbox_items: [], goals: [], goal_milestones: [], conversations: [], messages: [] };

type Action =
  | { type: "load"; data: Collections }
  | { type: "upsert"; table: TableName; row: { id: string } }
  | { type: "remove"; table: TableName; id: string }
  | { type: "reset" };

function reducer(state: Collections, action: Action): Collections {
  switch (action.type) {
    case "load":
      return action.data;
    case "reset":
      return EMPTY;
    case "upsert": {
      const rows = state[action.table] as { id: string }[];
      const idx = rows.findIndex((r) => r.id === action.row.id);
      const next = idx >= 0 ? rows.map((r, i) => (i === idx ? action.row : r)) : [...rows, action.row];
      return { ...state, [action.table]: next };
    }
    case "remove": {
      const rows = state[action.table] as { id: string }[];
      return { ...state, [action.table]: rows.filter((r) => r.id !== action.id) };
    }
  }
}

export type NewTask = Partial<Omit<Task, "id" | "user_id" | "created_at" | "updated_at">> & { title: string; id?: string };
export type NewEvent = Partial<Omit<CalendarEvent, "id" | "user_id" | "created_at" | "updated_at">> & { title: string; start_at: string; end_at: string; id?: string };

interface DataApi extends Collections {
  ready: boolean;
  /** Synchronous read of the latest row (includes not-yet-rendered optimistic updates). */
  peek: <T extends TableName>(table: T, id: string) => Row<T> | undefined;
  loadError: string | null;
  store: DataStore | null;
  profile: Profile | null;
  user: AuthUser;
  reload: () => Promise<void>;
  updateProfile: (patch: Partial<Profile>) => Promise<void>;
  updatePreferences: (patch: Partial<Preferences>) => Promise<void>;

  createTask: (input: NewTask) => Promise<Task | null>;
  updateTask: (id: string, patch: Partial<Task>) => Promise<boolean>;
  toggleTask: (id: string) => Promise<void>;
  deleteTask: (id: string, opts?: { silent?: boolean }) => Promise<void>;

  createEvent: (input: NewEvent) => Promise<CalendarEvent | null>;
  updateEvent: (id: string, patch: Partial<CalendarEvent>) => Promise<boolean>;
  deleteEvent: (id: string) => Promise<void>;

  createInboxItem: (input: Partial<InboxItem> & { original_content: string; content_type: InboxItem["content_type"] }) => Promise<InboxItem | null>;
  updateInboxItem: (id: string, patch: Partial<InboxItem>) => Promise<boolean>;
  deleteInboxItem: (id: string) => Promise<void>;

  createGoal: (input: Partial<Goal> & { title: string }) => Promise<Goal | null>;
  updateGoal: (id: string, patch: Partial<Goal>) => Promise<boolean>;
  deleteGoal: (id: string) => Promise<void>;
  createMilestone: (goalId: string, title: string) => Promise<GoalMilestone | null>;
  updateMilestone: (id: string, patch: Partial<GoalMilestone>) => Promise<boolean>;
  deleteMilestone: (id: string) => Promise<void>;

  createConversation: (title?: string) => Promise<Conversation | null>;
  updateConversation: (id: string, patch: Partial<Conversation>) => Promise<boolean>;
  deleteConversation: (id: string) => Promise<void>;
  addMessage: (input: Omit<Message, "id" | "user_id" | "created_at"> & { id?: string }) => Promise<Message | null>;
  updateMessage: (id: string, patch: Partial<Message>) => Promise<boolean>;

  wipeAll: () => Promise<void>;
}

const Ctx = createContext<DataApi | null>(null);

function nowIso() {
  return new Date().toISOString();
}

export function DataProvider({ user, children }: { user: AuthUser; children: ReactNode }) {
  const { toast } = useToast();
  const store = useMemo<DataStore>(() => (isSupabaseConfigured ? new SupabaseStore(getBrowserSupabase(), user.id) : new LocalStore(user.id)), [user.id]);
  const [state, setState] = useState<Collections>(EMPTY);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  // The ref is updated synchronously on every dispatch so sequential async
  // mutations always see the latest rows (React state updates are deferred).
  const stateRef = useRef<Collections>(EMPTY);
  const dispatch = useCallback((action: Action) => {
    stateRef.current = reducer(stateRef.current, action);
    setState(stateRef.current);
  }, []);
  const peek = useCallback(<T extends TableName>(table: T, id: string) => (stateRef.current[table] as Row<T>[]).find((r) => r.id === id), []);
  const profileRef = useRef(profile);
  profileRef.current = profile;

  useThemeSync(profile?.preferences.theme);

  const reload = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, ...lists] = await Promise.all([store.getProfile(), ...TABLES.map((t) => store.list(t))]);
      const data = Object.fromEntries(TABLES.map((t, i) => [t, lists[i]])) as Collections;
      let prof = p;
      if (!prof || !prof.full_name) {
        const base: Profile = prof ?? {
          id: user.id,
          full_name: "",
          email: user.email,
          timezone: localTimeZone(),
          preferences: DEFAULT_PREFERENCES,
          onboarded: false,
          is_sample: false,
          created_at: nowIso(),
          updated_at: nowIso(),
        };
        prof = await store.upsertProfile({ ...base, full_name: base.full_name || user.name || user.email.split("@")[0] });
      }
      prof = { ...prof, email: prof.email ?? user.email, preferences: { ...DEFAULT_PREFERENCES, ...prof.preferences } };
      dispatch({ type: "load", data });
      setProfile(prof);
      setReady(true);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Couldn't load your data.");
    }
  }, [dispatch, store, user]);

  useEffect(() => {
    setReady(false);
    dispatch({ type: "reset" });
    reload();
  }, [dispatch, reload]);

  /* ── generic optimistic helpers with rollback ─────────────────────── */

  const report = useCallback(
    (e: unknown, fallback: string) => {
      toast(e instanceof StoreError || e instanceof Error ? e.message : fallback, { tone: "error" });
    },
    [toast],
  );

  const insertRow = useCallback(
    async <T extends TableName>(table: T, row: Row<T>): Promise<Row<T> | null> => {
      dispatch({ type: "upsert", table, row });
      try {
        const saved = await store.insert(table, row);
        dispatch({ type: "upsert", table, row: saved });
        return saved;
      } catch (e) {
        dispatch({ type: "remove", table, id: row.id });
        report(e, "Couldn't save.");
        return null;
      }
    },
    [dispatch, store, report],
  );

  const patchRow = useCallback(
    async <T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<boolean> => {
      const prev = (stateRef.current[table] as Row<T>[]).find((r) => r.id === id);
      if (!prev) return false;
      const optimistic = { ...prev, ...patch, ...("updated_at" in prev ? { updated_at: nowIso() } : {}) } as Row<T>;
      dispatch({ type: "upsert", table, row: optimistic });
      try {
        const saved = await store.update(table, id, patch);
        dispatch({ type: "upsert", table, row: saved });
        return true;
      } catch (e) {
        dispatch({ type: "upsert", table, row: prev });
        report(e, "Couldn't save your changes.");
        return false;
      }
    },
    [dispatch, store, report],
  );

  const removeRow = useCallback(
    async (table: TableName, id: string, undoLabel?: string) => {
      const prev = (stateRef.current[table] as { id: string }[]).find((r) => r.id === id);
      if (!prev) return;
      dispatch({ type: "remove", table, id });
      try {
        await store.remove(table, id);
        if (undoLabel) {
          toast(undoLabel, {
            action: {
              label: "Undo",
              onClick: () => {
                insertRow(table, prev as Row<typeof table>);
              },
            },
          });
        }
      } catch (e) {
        dispatch({ type: "upsert", table, row: prev });
        report(e, "Couldn't delete.");
      }
    },
    [dispatch, store, toast, insertRow, report],
  );

  /* ── profile ──────────────────────────────────────────────────────── */

  const updateProfile = useCallback(
    async (patch: Partial<Profile>) => {
      const prev = profileRef.current;
      if (!prev) return;
      const next = { ...prev, ...patch };
      setProfile(next);
      try {
        const saved = await store.upsertProfile(next);
        setProfile({ ...saved, email: saved.email ?? user.email });
      } catch (e) {
        setProfile(prev);
        report(e, "Couldn't save your profile.");
      }
    },
    [store, report, user.email],
  );

  const updatePreferences = useCallback(
    async (patch: Partial<Preferences>) => {
      const prev = profileRef.current;
      if (!prev) return;
      await updateProfile({ preferences: { ...prev.preferences, ...patch } });
    },
    [updateProfile],
  );

  /* ── tasks ────────────────────────────────────────────────────────── */

  const createTask = useCallback(
    (input: NewTask) => {
      const t = nowIso();
      const task: Task = {
        id: input.id ?? uid(),
        user_id: user.id,
        title: input.title.trim().slice(0, 200),
        description: input.description ?? null,
        category: input.category ?? "other",
        priority: input.priority ?? "normal",
        status: input.status ?? "todo",
        due_at: input.due_at ?? null,
        due_all_day: input.due_all_day ?? false,
        estimated_minutes: input.estimated_minutes ?? null,
        scheduled_start: input.scheduled_start ?? null,
        scheduled_end: input.scheduled_end ?? null,
        goal_id: input.goal_id ?? null,
        subtasks: input.subtasks ?? [],
        source_inbox_id: input.source_inbox_id ?? null,
        completed_at: input.completed_at ?? null,
        created_at: t,
        updated_at: t,
      };
      return insertRow("tasks", task);
    },
    [insertRow, user.id],
  );

  const updateTask = useCallback((id: string, patch: Partial<Task>) => patchRow("tasks", id, patch), [patchRow]);

  const toggleTask = useCallback(
    async (id: string) => {
      const task = stateRef.current.tasks.find((t) => t.id === id);
      if (!task) return;
      const done = task.status !== "done";
      const ok = await patchRow("tasks", id, { status: done ? "done" : "todo", completed_at: done ? nowIso() : null });
      if (ok && done) toast(`Completed “${task.title}”`, { tone: "success", action: { label: "Undo", onClick: () => patchRow("tasks", id, { status: "todo", completed_at: null }) } });
    },
    [patchRow, toast],
  );

  const deleteTask = useCallback((id: string, opts?: { silent?: boolean }) => removeRow("tasks", id, opts?.silent ? undefined : "Task deleted"), [removeRow]);

  /* ── events ───────────────────────────────────────────────────────── */

  const createEvent = useCallback(
    (input: NewEvent) => {
      const t = nowIso();
      return insertRow("events", {
        id: input.id ?? uid(),
        user_id: user.id,
        title: input.title.trim().slice(0, 200),
        description: input.description ?? null,
        location: input.location ?? null,
        start_at: input.start_at,
        end_at: input.end_at,
        all_day: input.all_day ?? false,
        timezone: input.timezone ?? localTimeZone(),
        created_at: t,
        updated_at: t,
      });
    },
    [insertRow, user.id],
  );
  const updateEvent = useCallback((id: string, patch: Partial<CalendarEvent>) => patchRow("events", id, patch), [patchRow]);
  const deleteEvent = useCallback((id: string) => removeRow("events", id, "Event deleted"), [removeRow]);

  /* ── inbox ────────────────────────────────────────────────────────── */

  const createInboxItem = useCallback<DataApi["createInboxItem"]>(
    (input) => {
      const t = nowIso();
      return insertRow("inbox_items", {
        id: input.id ?? uid(),
        user_id: user.id,
        original_content: input.original_content.slice(0, 20000),
        content_type: input.content_type,
        attachment_url: input.attachment_url ?? null,
        extracted_data: input.extracted_data ?? null,
        processing_status: input.processing_status ?? "pending",
        resolution: input.resolution ?? null,
        error: input.error ?? null,
        created_at: t,
        updated_at: t,
      });
    },
    [insertRow, user.id],
  );
  const updateInboxItem = useCallback((id: string, patch: Partial<InboxItem>) => patchRow("inbox_items", id, patch), [patchRow]);
  const deleteInboxItem = useCallback(
    async (id: string) => {
      const item = stateRef.current.inbox_items.find((i) => i.id === id);
      await removeRow("inbox_items", id, "Capture deleted");
      // attachment is kept until undo window passes; remove afterwards if item stays deleted
      if (item?.attachment_url) {
        window.setTimeout(() => {
          if (!stateRef.current.inbox_items.some((i) => i.id === id)) store.removeAttachment(item.attachment_url!).catch(() => {});
        }, 8000);
      }
    },
    [removeRow, store],
  );

  /* ── goals ────────────────────────────────────────────────────────── */

  const createGoal = useCallback<DataApi["createGoal"]>(
    (input) => {
      const t = nowIso();
      return insertRow("goals", {
        id: input.id ?? uid(),
        user_id: user.id,
        title: input.title.trim().slice(0, 200),
        description: input.description ?? null,
        category: input.category ?? "personal",
        target_date: input.target_date ?? null,
        status: input.status ?? "active",
        created_at: t,
        updated_at: t,
      });
    },
    [insertRow, user.id],
  );
  const updateGoal = useCallback((id: string, patch: Partial<Goal>) => patchRow("goals", id, patch), [patchRow]);
  const deleteGoal = useCallback(
    async (id: string) => {
      const milestones = stateRef.current.goal_milestones.filter((m) => m.goal_id === id);
      const linked = stateRef.current.tasks.filter((t) => t.goal_id === id);
      await removeRow("goals", id);
      milestones.forEach((m) => dispatch({ type: "remove", table: "goal_milestones", id: m.id }));
      linked.forEach((t) => dispatch({ type: "upsert", table: "tasks", row: { ...t, goal_id: null } as Task }));
      toast("Goal deleted");
    },
    [dispatch, removeRow, toast],
  );
  const createMilestone = useCallback(
    (goalId: string, title: string) => {
      const position = stateRef.current.goal_milestones.filter((m) => m.goal_id === goalId).length;
      return insertRow("goal_milestones", { id: uid(), user_id: user.id, goal_id: goalId, title: title.trim().slice(0, 200), completed: false, position, created_at: nowIso() });
    },
    [insertRow, user.id],
  );
  const updateMilestone = useCallback((id: string, patch: Partial<GoalMilestone>) => patchRow("goal_milestones", id, patch), [patchRow]);
  const deleteMilestone = useCallback((id: string) => removeRow("goal_milestones", id), [removeRow]);

  /* ── conversations ────────────────────────────────────────────────── */

  const createConversation = useCallback(
    (title = "New conversation") => {
      const t = nowIso();
      return insertRow("conversations", { id: uid(), user_id: user.id, title, created_at: t, updated_at: t });
    },
    [insertRow, user.id],
  );
  const updateConversation = useCallback((id: string, patch: Partial<Conversation>) => patchRow("conversations", id, patch), [patchRow]);
  const deleteConversation = useCallback(
    async (id: string) => {
      const msgs = stateRef.current.messages.filter((m) => m.conversation_id === id);
      await removeRow("conversations", id);
      msgs.forEach((m) => dispatch({ type: "remove", table: "messages", id: m.id }));
    },
    [dispatch, removeRow],
  );
  const addMessage = useCallback<DataApi["addMessage"]>((input) => insertRow("messages", { ...input, id: input.id ?? uid(), user_id: user.id, created_at: nowIso() }), [insertRow, user.id]);
  const updateMessage = useCallback((id: string, patch: Partial<Message>) => patchRow("messages", id, patch), [patchRow]);

  const wipeAll = useCallback(async () => {
    await store.wipe();
    dispatch({ type: "reset" });
    await updateProfile({ is_sample: false });
  }, [dispatch, store, updateProfile]);

  const value = useMemo<DataApi>(
    () => ({
      ...state,
      ready,
      peek,
      loadError,
      store,
      profile,
      user,
      reload,
      updateProfile,
      updatePreferences,
      createTask,
      updateTask,
      toggleTask,
      deleteTask,
      createEvent,
      updateEvent,
      deleteEvent,
      createInboxItem,
      updateInboxItem,
      deleteInboxItem,
      createGoal,
      updateGoal,
      deleteGoal,
      createMilestone,
      updateMilestone,
      deleteMilestone,
      createConversation,
      updateConversation,
      deleteConversation,
      addMessage,
      updateMessage,
      wipeAll,
    }),
    [state, ready, peek, loadError, store, profile, user, reload, updateProfile, updatePreferences, createTask, updateTask, toggleTask, deleteTask, createEvent, updateEvent, deleteEvent, createInboxItem, updateInboxItem, deleteInboxItem, createGoal, updateGoal, deleteGoal, createMilestone, updateMilestone, deleteMilestone, createConversation, updateConversation, deleteConversation, addMessage, updateMessage, wipeAll],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useData must be used within DataProvider");
  return ctx;
}
