import { expect, test } from "@playwright/test";
import { heuristicExtract } from "../../src/lib/ai/heuristic-extract";
import { busyForRange, findSlots, planDay, validateBlocks } from "../../src/lib/planner";
import { validateActions } from "../../src/lib/ai/actions";
import { offlineAssistant } from "../../src/lib/ai/offline-assistant";
import { computeStats } from "../../src/lib/insights";
import { addDaysKey, weekdayOfKey, zonedParts, zonedTimeToUtc } from "../../src/lib/time";
import { DEFAULT_PREFERENCES, type CalendarEvent, type Goal, type Task } from "../../src/lib/types";

const TZ = "America/New_York";
const FRIDAY = "2026-10-02"; // a Friday

function task(p: Partial<Task> & { title: string }): Task {
  return {
    id: p.id ?? Math.random().toString(36).slice(2),
    user_id: "u1",
    description: null,
    category: "other",
    priority: "normal",
    status: "todo",
    due_at: null,
    due_all_day: false,
    estimated_minutes: null,
    scheduled_start: null,
    scheduled_end: null,
    goal_id: null,
    subtasks: [],
    source_inbox_id: null,
    completed_at: null,
    created_at: "2026-09-30T12:00:00Z",
    updated_at: "2026-09-30T12:00:00Z",
    ...p,
  };
}

function event(title: string, date: string, start: string, end: string): CalendarEvent {
  return { id: title, user_id: "u1", title, description: null, location: null, start_at: zonedTimeToUtc(date, start, TZ).toISOString(), end_at: zonedTimeToUtc(date, end, TZ).toISOString(), all_day: false, timezone: TZ, created_at: "", updated_at: "" };
}

test.describe("time utilities", () => {
  test("weekday math and zone conversion across DST", () => {
    expect(weekdayOfKey(FRIDAY)).toBe(5);
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    // 09:00 New York is 13:00Z in EDT (Oct) and 14:00Z in EST (Nov 2 after DST ends)
    expect(zonedTimeToUtc("2026-10-02", "09:00", TZ).toISOString()).toBe("2026-10-02T13:00:00.000Z");
    expect(zonedTimeToUtc("2026-11-02", "09:00", TZ).toISOString()).toBe("2026-11-02T14:00:00.000Z");
    expect(zonedParts(new Date("2026-11-02T14:00:00Z"), TZ).hhmm).toBe("09:00");
  });
});

test.describe("heuristic extraction", () => {
  test("spec example: two tasks with correct days and categories", () => {
    const ex = heuristicExtract("Remember I have chemistry homework due Thursday and need to call the supplier Friday.", { today: "2026-10-05" /* Monday */ });
    expect(ex.items).toHaveLength(2);
    const [a, b] = ex.items;
    expect(a).toMatchObject({ kind: "task", title: "Chemistry homework", category: "school", date: "2026-10-08", has_deadline: true });
    expect(b).toMatchObject({ kind: "task", category: "business", date: "2026-10-09" });
    expect(b.title.toLowerCase()).toContain("call the supplier");
  });

  test("never invents a deadline", () => {
    const ex = heuristicExtract("Buy a new phone charger", { today: FRIDAY });
    expect(ex.items[0].date).toBeNull();
    expect(ex.items[0].has_deadline).toBe(false);
  });

  test("vague dates are flagged for confirmation instead of guessed", () => {
    const ex = heuristicExtract("Finish the quarterly report next week", { today: FRIDAY });
    expect(ex.items[0].date).toBeNull();
    expect(ex.items[0].needs_confirmation).toBe(true);
    expect(ex.items[0].ambiguity).toContain("next week");
  });

  test("same weekday as today is ambiguous", () => {
    const ex = heuristicExtract("Submit the form Friday", { today: FRIDAY });
    expect(ex.items[0].needs_confirmation).toBe(true);
  });

  test("events with time ranges and ideas", () => {
    const ev = heuristicExtract("Team meeting 2-3pm on Monday", { today: FRIDAY }).items[0];
    expect(ev).toMatchObject({ kind: "event", date: "2026-10-05", time: "14:00", end_time: "15:00", category: "work" });
    const idea = heuristicExtract("Idea: an app that reminds me to water plants", { today: FRIDAY }).items[0];
    expect(idea.kind).toBe("idea");
  });

  test("urgency and durations", () => {
    const it = heuristicExtract("Pay rent tomorrow, urgent, takes 10 minutes", { today: FRIDAY }).items[0];
    expect(it).toMatchObject({ priority: "urgent", date: "2026-10-03", estimated_minutes: 10 });
  });
});

test.describe("planner", () => {
  const prefs = { work_start: "09:00", work_end: "17:00", daily_focus_minutes: 240 };
  const now = zonedTimeToUtc(FRIDAY, "07:00", TZ).toISOString();
  const tasks = [
    task({ id: "a", title: "Lab report", priority: "high", estimated_minutes: 90, due_at: zonedTimeToUtc(FRIDAY, "17:00", TZ).toISOString() }),
    task({ id: "b", title: "Call supplier", priority: "urgent", estimated_minutes: 15, due_at: zonedTimeToUtc(FRIDAY, "23:59", TZ).toISOString(), due_all_day: true }),
    task({ id: "c", title: "Someday", priority: "low" }),
  ];
  const events = [event("Lecture", FRIDAY, "10:00", "11:15"), event("Sync", FRIDAY, "14:00", "14:45")];

  test("places candidates inside working hours without overlapping events", () => {
    const plan = planDay({ date: FRIDAY, now, timeZone: TZ, tasks, events, prefs });
    expect(plan.blocks.map((b) => b.task_id).sort()).toEqual(["a", "b"]);
    const ws = zonedTimeToUtc(FRIDAY, "09:00", TZ).getTime();
    const we = zonedTimeToUtc(FRIDAY, "17:00", TZ).getTime();
    const busy = busyForRange(ws, we, events, []);
    for (const b of plan.blocks) {
      const s = Date.parse(b.start);
      const e = Date.parse(b.end);
      expect(s).toBeGreaterThanOrEqual(ws);
      expect(e).toBeLessThanOrEqual(we);
      for (const x of busy) expect(s < x.end && x.start < e).toBe(false);
    }
    // the low-priority task without a date is not forced into the day
    expect(plan.blocks.some((b) => b.task_id === "c")).toBe(false);
  });

  test("validateBlocks rejects conflicts, unknown tasks and out-of-day blocks", () => {
    const iso = (t: string) => zonedTimeToUtc(FRIDAY, t, TZ).toISOString();
    const { accepted, rejected } = validateBlocks(
      [
        { task_id: "a", start: iso("10:30"), end: iso("11:30"), reason: "" }, // overlaps lecture
        { task_id: "b", start: iso("12:00"), end: iso("12:15"), reason: "" },
        { task_id: "zzz", start: iso("13:00"), end: iso("13:30"), reason: "" },
        { task_id: "c", start: zonedTimeToUtc(addDaysKey(FRIDAY, 1), "09:00", TZ).toISOString(), end: zonedTimeToUtc(addDaysKey(FRIDAY, 1), "10:00", TZ).toISOString(), reason: "" },
      ],
      { date: FRIDAY, timeZone: TZ, nowIso: now, events, tasks },
    );
    expect(accepted.map((a) => a.task_id)).toEqual(["b"]);
    expect(rejected.map((r) => r.reason)).toEqual(expect.arrayContaining(["Overlaps Lecture", "Unknown or completed task", "Outside the requested day"]));
  });

  test("ends gracefully after working hours", () => {
    const late = zonedTimeToUtc(FRIDAY, "18:00", TZ).toISOString();
    const plan = planDay({ date: FRIDAY, now: late, timeZone: TZ, tasks, events, prefs });
    expect(plan.blocks).toHaveLength(0);
    expect(plan.unscheduled.length).toBeGreaterThan(0);
  });

  test("findSlots proposes conflict-free times", () => {
    const slots = findSlots({ task: tasks[0], fromDate: FRIDAY, nowIso: now, timeZone: TZ, events, tasks, prefs, limit: 3 });
    expect(slots.length).toBeGreaterThan(0);
    for (const s of slots) for (const e of events) expect(Date.parse(s.start) < Date.parse(e.end_at) && Date.parse(e.start_at) < Date.parse(s.end)).toBe(false);
  });
});

test.describe("assistant action validation", () => {
  const tasks = [task({ id: "t1", title: "Essay" }), task({ id: "t2", title: "Done thing", status: "done" })];
  const goals: Goal[] = [{ id: "g1", user_id: "u1", title: "Learn guitar", description: null, category: "personal", target_date: null, status: "active", created_at: "", updated_at: "" }];
  const events = [event("Lecture", FRIDAY, "10:00", "11:00")];
  const ctx = { tasks, events, goals, tz: TZ, nowIso: zonedTimeToUtc(FRIDAY, "07:00", TZ).toISOString() };

  test("accepts valid actions, converts local times, flags conflicts and destructive ops", () => {
    const { accepted, rejected } = validateActions(
      [
        { type: "schedule_task", task_id: "t1", start: "2026-10-02T10:30", end: "2026-10-02T11:30" },
        { type: "delete_task", task_id: "t1" },
        { type: "create_task", title: "Call mom", category: "personal", priority: "normal", due_date: "2026-10-03" },
        { type: "add_milestones", goal_id: "g1", items: ["Learn 3 chords"] },
      ],
      ctx,
    );
    expect(rejected).toHaveLength(0);
    expect(accepted[0]).toMatchObject({ type: "schedule_task", start: "2026-10-02T14:30:00.000Z" });
    expect(accepted[0].warning).toContain("Lecture");
    expect(accepted[1].destructive).toBe(true);
    expect(accepted[2].summary).toContain("Call mom");
  });

  test("rejects fabricated ids, completed tasks and malformed actions", () => {
    const { accepted, rejected } = validateActions(
      [
        { type: "complete_task", task_id: "does-not-exist" },
        { type: "complete_task", task_id: "t2" },
        { type: "add_milestones", goal_id: "nope", items: ["x"] },
        { type: "create_event", title: "Bad", start: "2026-10-02T12:00", end: "2026-10-02T11:00" },
        { type: "drop_database" },
      ],
      ctx,
    );
    expect(accepted).toHaveLength(0);
    expect(rejected).toHaveLength(5);
  });

  test("offline assistant answers overdue questions from real data only", () => {
    const snap = { name: "A", preferences: DEFAULT_PREFERENCES, tasks: [task({ id: "o", title: "Late thing", due_at: "2026-09-30T12:00:00Z" })], events: [], goals: [], milestones: [], inbox: [] };
    const res = offlineAssistant("what's overdue?", snap, { today: FRIDAY, now: zonedTimeToUtc(FRIDAY, "09:00", TZ).toISOString(), timezone: TZ, utc_offset_minutes: -240 });
    expect(res.reply).toContain("Late thing");
    expect(res.actions).toHaveLength(0);
  });
});

test.describe("insights", () => {
  test("stats come only from records", () => {
    const now = zonedTimeToUtc(FRIDAY, "12:00", TZ).toISOString();
    const tasks = [
      task({ title: "a", status: "done", completed_at: zonedTimeToUtc(FRIDAY, "09:00", TZ).toISOString(), estimated_minutes: 30 }),
      task({ title: "b", status: "done", completed_at: zonedTimeToUtc("2026-09-24", "09:00", TZ).toISOString() }),
      task({ title: "c", due_at: zonedTimeToUtc("2026-10-01", "09:00", TZ).toISOString() }),
      task({ title: "d", due_at: zonedTimeToUtc("2026-10-04", "09:00", TZ).toISOString(), estimated_minutes: 60 }),
    ];
    const s = computeStats(tasks, [], [], now, TZ, 1);
    expect(s.weekStart).toBe("2026-09-28");
    expect(s.completedThisWeek).toBe(1);
    expect(s.completedLastWeek).toBe(1);
    expect(s.overdueCount).toBe(1);
    expect(s.dueNext7).toBe(1);
    expect(s.minutesDueNext7).toBe(60);
    expect(s.weeklyTrend.reduce((a, w) => a + w.completed, 0)).toBe(2);
  });
});
