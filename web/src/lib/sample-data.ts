/**
 * Clearly-labelled sample workspace for demos. Dates are generated relative to
 * "now" so the dashboard looks alive whenever it's loaded. Only ever loaded on
 * explicit request ("Try the demo" / Settings → Load sample data), and the
 * profile is flagged `is_sample` so the UI shows a banner.
 */
import type { DataStore } from "./data/store";
import type { CalendarEvent, Goal, GoalMilestone, InboxItem, Task } from "./types";
import { uid } from "./id";
import { addDaysKey, localDate, localKey, localTimeZone } from "./time";

export async function loadSampleData(store: DataStore) {
  const userId = store.userId;
  const today = localKey();
  const d = (offset: number, time = "23:59") => localDate(addDaysKey(today, offset), time).toISOString();
  const now = new Date().toISOString();
  const tz = localTimeZone();

  const goalLaunch: Goal = { id: uid(), user_id: userId, title: "Launch the candle shop online", description: "Get the Etsy store live with the first 10 products before the holiday season.", category: "business", target_date: addDaysKey(today, 40), status: "active", created_at: d(-20, "10:00"), updated_at: now };
  const goalSpanish: Goal = { id: uid(), user_id: userId, title: "Reach conversational Spanish", description: "Hold a 15-minute conversation without switching to English.", category: "personal", target_date: addDaysKey(today, 120), status: "active", created_at: d(-30, "10:00"), updated_at: now };

  const ms = (goal: Goal, title: string, completed: boolean, position: number): GoalMilestone => ({ id: uid(), user_id: userId, goal_id: goal.id, title, completed, position, created_at: d(-15, "09:00") });
  const milestones = [
    ms(goalLaunch, "Finalize 10 product scents", true, 0),
    ms(goalLaunch, "Photograph the product line", true, 1),
    ms(goalLaunch, "Write listings and pricing", false, 2),
    ms(goalLaunch, "Open the Etsy store", false, 3),
    ms(goalSpanish, "Finish A2 course on Duolingo", true, 0),
    ms(goalSpanish, "Book 4 tutor sessions", false, 1),
  ];

  const task = (p: Partial<Task> & { title: string }): Task => ({
    id: uid(),
    user_id: userId,
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
    created_at: d(-6, "09:00"),
    updated_at: now,
    ...p,
  });

  const tasks: Task[] = [
    task({ title: "Chemistry lab report", category: "school", priority: "high", due_at: d(0, "17:00"), estimated_minutes: 90, subtasks: [{ id: uid(), title: "Results table", done: true }, { id: uid(), title: "Discussion section", done: false }, { id: uid(), title: "Cite sources", done: false }] }),
    task({ title: "Call the wax supplier about the bulk order", category: "business", priority: "urgent", due_at: d(0), due_all_day: true, estimated_minutes: 15, goal_id: goalLaunch.id }),
    task({ title: "Write product listings (first 5)", category: "business", priority: "high", due_at: d(2), due_all_day: true, estimated_minutes: 120, goal_id: goalLaunch.id }),
    task({ title: "Pay phone bill", category: "personal", due_at: d(-1), due_all_day: true, estimated_minutes: 5 }),
    task({ title: "Read chapter 7 for history", category: "school", due_at: d(3), due_all_day: true, estimated_minutes: 60 }),
    task({ title: "Book a Spanish tutor session", category: "personal", priority: "normal", estimated_minutes: 10, goal_id: goalSpanish.id }),
    task({ title: "Renew gym membership", category: "health", priority: "low", due_at: d(6), due_all_day: true, estimated_minutes: 10 }),
    task({ title: "Prep slides for weekly stand-up", category: "work", priority: "high", estimated_minutes: 45, due_at: d(1, "09:00") }),
    task({ title: "Order shipping boxes", category: "business", status: "done", completed_at: d(-1, "15:20"), estimated_minutes: 15, goal_id: goalLaunch.id }),
    task({ title: "Problem set 4", category: "school", status: "done", completed_at: d(-2, "21:10"), estimated_minutes: 90 }),
    task({ title: "Groceries", category: "personal", status: "done", completed_at: d(0, "08:30"), estimated_minutes: 40 }),
    task({ title: "Email landlord about the heater", category: "personal", status: "done", completed_at: d(-4, "12:00"), estimated_minutes: 10 }),
    task({ title: "Photograph candle line", category: "business", status: "done", completed_at: d(-9, "16:00"), estimated_minutes: 120, goal_id: goalLaunch.id }),
    task({ title: "30-minute run", category: "health", status: "done", completed_at: d(-3, "07:15"), estimated_minutes: 30 }),
  ];

  const ev = (title: string, offset: number, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({ id: uid(), user_id: userId, title, description: null, location: null, start_at: d(offset, start), end_at: d(offset, end), all_day: false, timezone: tz, created_at: d(-5, "09:00"), updated_at: now, ...extra });
  const events: CalendarEvent[] = [
    ev("Organic Chemistry lecture", 0, "10:00", "11:15", { location: "Hall B" }),
    ev("Team sync", 0, "14:00", "14:45"),
    ev("Dentist", 1, "16:00", "16:45", { location: "Dr. Patel" }),
    ev("Study group", 2, "18:00", "19:30"),
    ev("Weekly stand-up", 1, "09:30", "10:00"),
  ];

  const inbox: InboxItem[] = [
    {
      id: uid(),
      user_id: userId,
      original_content: "Mia: hey! can you send me the candle price list by Friday? also are we still on for coffee saturday 11am?",
      content_type: "paste",
      attachment_url: null,
      processing_status: "needs_review",
      resolution: null,
      error: null,
      created_at: new Date(Date.now() - 2 * 3600000).toISOString(),
      updated_at: now,
      extracted_data: {
        summary: "A message from Mia asking for the price list and confirming Saturday coffee.",
        source: "heuristic",
        notice: "Sample capture",
        processed_at: now,
        items: [
          { id: uid(), kind: "task", title: "Send Mia the candle price list", description: null, category: "business", priority: "normal", estimated_minutes: 15, date: nextWeekday(today, 5), time: null, end_time: null, has_deadline: true, needs_confirmation: false, ambiguity: null, status: "pending" },
          { id: uid(), kind: "event", title: "Coffee with Mia", description: null, category: "personal", priority: "normal", estimated_minutes: 60, date: nextWeekday(today, 6), time: "11:00", end_time: null, has_deadline: false, needs_confirmation: false, ambiguity: null, status: "pending" },
        ],
      },
    },
  ];

  for (const g of [goalLaunch, goalSpanish]) await store.insert("goals", g);
  for (const m of milestones) await store.insert("goal_milestones", m);
  for (const i of inbox) await store.insert("inbox_items", i);
  for (const t of tasks) await store.insert("tasks", t);
  for (const e of events) await store.insert("events", e);
}

function nextWeekday(today: string, target: number) {
  const cur = new Date(`${today}T12:00:00`).getDay();
  const diff = ((target - cur + 7) % 7) || 7;
  return addDaysKey(today, diff);
}
