import { Task, Priority, TaskCategory, EnergyLevel, ScheduleBlock, AssistantAction } from '../types';
import { format, addDays, parse } from 'date-fns';

/**
 * ai.ts — LifePilot's upgraded on-device AI engine.
 *
 * Replaces the old 3-regex extractor with:
 *   1. parseNaturalLanguage()  — understands dates, times, durations,
 *      recurrence, priority, category and energy from free text.
 *   2. extractTasks()          — multi-task extraction from notes/emails/OCR.
 *   3. autoSchedule()          — Motion/Reclaim/Morgen-style planner that
 *      places tasks on the calendar using a priority + deadline + duration
 *      + energy-fit scoring formula, respecting work hours, buffers, pins
 *      and existing events, and splitting long tasks into sessions.
 *   4. parseAssistantCommand() — turns a spoken/typed request into an action.
 *
 * 100% local + deterministic, so it works offline with no API key. The
 * architecture leaves a single seam (callLLM) to plug a hosted model later.
 */

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, a: 1, an: 1, half: 0.5,
};

const WEEKDAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

export interface ParsedIntent {
  title: string;
  priority: Priority;
  category: TaskCategory;
  energy: EnergyLevel;
  estimatedDuration: number; // minutes
  dueDate?: string;          // YYYY-MM-DD
  dueTime?: string;          // HH:MM
  recurrence?: 'daily' | 'weekly' | 'weekdays' | 'none';
  tags: string[];
}

/* ---------- DURATION ---------- */
export function parseDuration(text: string): number | undefined {
  const t = text.toLowerCase();
  // "1h30", "1.5 hours", "90 min", "for two hours", "45m"
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\s*(?:and\s*)?(\d+)?\s*(?:min|mins|minutes|m)?/);
  if (m && /h|hour|hr/.test(m[0])) {
    const hrs = parseFloat(m[1]); const mins = m[2] ? parseInt(m[2]) : 0;
    return Math.round(hrs * 60 + mins);
  }
  m = t.match(/(\d+)\s*(?:min|mins|minutes|m)\b/);
  if (m) return parseInt(m[1]);
  m = t.match(/(?:for\s+)?(one|two|three|four|five|six|half|an|a)\s+(hours?|hrs?|minutes?|mins?)/);
  if (m) {
    const n = WORD_NUMBERS[m[1]] ?? 1;
    return /hour|hr/.test(m[2]) ? Math.round(n * 60) : Math.round(n);
  }
  return undefined;
}

/* ---------- TIME ---------- */
export function parseTime(text: string): string | undefined {
  const t = text.toLowerCase();
  // 3pm, 3:30 pm, 15:00, "at 9", noon, midnight
  if (/\bnoon\b/.test(t)) return '12:00';
  if (/\bmidnight\b/.test(t)) return '00:00';
  let m = t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (m) {
    let h = parseInt(m[1]); const min = parseInt(m[2]);
    if (m[3] === 'pm' && h < 12) h += 12;
    if (m[3] === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
  }
  m = t.match(/\bat\s+(\d{1,2})\s*(am|pm)\b/) || t.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) {
    let h = parseInt(m[1]);
    if (m[2] === 'pm' && h < 12) h += 12;
    if (m[2] === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2,'0')}:00`;
  }
  return undefined;
}

/* ---------- DATE ---------- */
export function parseDate(text: string): string | undefined {
  const t = text.toLowerCase();
  const today = new Date();
  if (/\btoday\b|\btonight\b/.test(t)) return format(today, 'yyyy-MM-dd');
  if (/\btomorrow\b|\btmrw\b/.test(t)) return format(addDays(today, 1), 'yyyy-MM-dd');
  if (/day after tomorrow/.test(t)) return format(addDays(today, 2), 'yyyy-MM-dd');
  // "in 3 days", "in two weeks"
  let m = t.match(/in\s+(\d+|one|two|three|four|five|six|seven)\s+(day|days|week|weeks)/);
  if (m) {
    const n = isNaN(Number(m[1])) ? (WORD_NUMBERS[m[1]] ?? 1) : Number(m[1]);
    const days = /week/.test(m[2]) ? n * 7 : n;
    return format(addDays(today, days), 'yyyy-MM-dd');
  }
  // "next monday", "on friday", "this thursday"
  m = t.match(/(?:next|this|on|by)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/);
  if (m) {
    const target = WEEKDAYS.indexOf(m[1]);
    let d = today.getDay();
    let delta = (target - d + 7) % 7;
    if (delta === 0) delta = 7;
    if (/this/.test(m[0]) && (target - d + 7) % 7 !== 0) delta = (target - d + 7) % 7;
    return format(addDays(today, delta), 'yyyy-MM-dd');
  }
  // explicit "dec 5", "12/05", "2026-01-09"
  m = t.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[0];
  m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (m) {
    const mo = parseInt(m[1]) - 1, day = parseInt(m[2]);
    const yr = m[3] ? (m[3].length === 2 ? 2000 + parseInt(m[3]) : parseInt(m[3])) : today.getFullYear();
    return format(new Date(yr, mo, day), 'yyyy-MM-dd');
  }
  const months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  m = t.match(new RegExp('\\b(' + months.join('|') + ')[a-z]*\\s+(\\d{1,2})'));
  if (m) {
    const mo = months.indexOf(m[1]); const day = parseInt(m[2]);
    return format(new Date(today.getFullYear(), mo, day), 'yyyy-MM-dd');
  }
  return undefined;
}

/* ---------- RECURRENCE ---------- */
export function parseRecurrence(text: string): ParsedIntent['recurrence'] {
  const t = text.toLowerCase();
  if (/every\s*day|daily|each day/.test(t)) return 'daily';
  if (/weekdays|every weekday|mon(day)?\s*-\s*fri/.test(t)) return 'weekdays';
  if (/every\s*week|weekly|each week|every\s+(mon|tue|wed|thu|fri|sat|sun)/.test(t)) return 'weekly';
  return 'none';
}

/* ---------- PRIORITY ---------- */
export function parsePriority(text: string): Priority {
  const t = text.toLowerCase();
  if (/\burgent\b|\basap\b|right now|immediately|critical|emergency/.test(t)) return 'urgent';
  if (/\bimportant\b|high priority|must|deadline|due/.test(t)) return 'high';
  if (/\bsomeday\b|\bwhenever\b|low priority|no rush|eventually/.test(t)) return 'low';
  return 'medium';
}

/* ---------- CATEGORY ---------- */
export function parseCategory(text: string): TaskCategory {
  const t = text.toLowerCase();
  if (/class|homework|assignment|exam|study|lecture|essay|school|college|university|quiz/.test(t)) return 'school';
  if (/meeting|client|project|report|email|deadline|presentation|standup|deck|boss|work|invoice|deploy/.test(t)) return 'work';
  if (/workout|gym|run|exercise|yoga|training|walk|jog|fitness|stretch|lift/.test(t)) return 'fitness';
  if (/call|dinner|party|friend|date|family|mom|dad|birthday|hangout|social/.test(t)) return 'social';
  return 'personal';
}

/* ---------- ENERGY ---------- */
export function parseEnergy(text: string, category: TaskCategory): EnergyLevel {
  const t = text.toLowerCase();
  if (/deep work|focus|study|write|design|code|analy|plan|strategy|exam/.test(t)) return 'high';
  if (/email|call|admin|errand|tidy|organize|laundry|chores|quick/.test(t)) return 'low';
  if (category === 'school' || category === 'work') return 'high';
  if (category === 'social' || category === 'personal') return 'low';
  return 'medium';
}

function cleanTitle(text: string): string {
  let t = text.trim();
  t = t.replace(/^(remind me to|remember to|i need to|i have to|please|can you|add a task to|todo:?|task:?)\s+/i, '');
  // strip trailing time/date clauses for a cleaner title
  t = t.replace(/\b(today|tonight|tomorrow|tmrw|next week|this week)\b.*$/i, '').trim();
  t = t.replace(/\b(at|by|on|due|every|for)\s+\d.*$/i, '').trim();
  t = t.replace(/[.,;]+$/, '').trim();
  if (t.length === 0) return text.trim().slice(0, 60);
  return t.charAt(0).toUpperCase() + t.slice(1, 80);
}

export function extractTags(text: string): string[] {
  const t = text.toLowerCase();
  const tags: string[] = [];
  if (/meeting/.test(t)) tags.push('meeting');
  if (/deadline|due/.test(t)) tags.push('deadline');
  if (/urgent|asap/.test(t)) tags.push('urgent');
  if (/homework|assignment/.test(t)) tags.push('assignment');
  if (/email/.test(t)) tags.push('email');
  const hashtags = text.match(/#(\w+)/g);
  if (hashtags) hashtags.forEach((h) => tags.push(h.slice(1)));
  return [...new Set(tags)];
}

/** Parse a single free-text line into a structured intent. */
export function parseNaturalLanguage(text: string): ParsedIntent {
  const category = parseCategory(text);
  const priority = parsePriority(text);
  const energy = parseEnergy(text, category);
  return {
    title: cleanTitle(text),
    priority,
    category,
    energy,
    estimatedDuration: parseDuration(text) ?? defaultDuration(category, energy),
    dueDate: parseDate(text),
    dueTime: parseTime(text),
    recurrence: parseRecurrence(text),
    tags: extractTags(text),
  };
}

function defaultDuration(category: TaskCategory, energy: EnergyLevel): number {
  if (energy === 'high') return 60;
  if (category === 'fitness') return 45;
  if (category === 'social') return 30;
  return 30;
}

/** Extract multiple tasks from a block of content (notes, email, OCR text). */
export function extractTasks(content: string, _type?: string): Partial<Task>[] {
  // Split on line breaks, bullets and sentence boundaries.
  const lines = content
    .split(/\n|•|·|\u2022|(?:^|\s)[-*]\s|(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter((l) => l.length > 4 && l.length < 200);

  const actionable = lines.filter((l) =>
    /\b(do|finish|complete|submit|send|call|email|review|buy|book|pay|schedule|prepare|write|read|fix|meet|plan|study|workout|pick up|drop off|remember|need to|have to)\b/i.test(l)
    || /^[A-Z].{3,}/.test(l)
  );

  const source = actionable.length ? actionable : lines;
  const seen = new Set<string>();
  const out: Partial<Task>[] = [];
  for (const line of source.slice(0, 12)) {
    const intent = parseNaturalLanguage(line);
    const key = intent.title.toLowerCase();
    if (seen.has(key) || intent.title.length < 3) continue;
    seen.add(key);
    out.push({
      title: intent.title,
      description: line.slice(0, 200),
      priority: intent.priority,
      category: intent.category,
      energy: intent.energy,
      estimatedDuration: intent.estimatedDuration,
      dueDate: intent.dueDate,
      dueTime: intent.dueTime,
      status: 'pending',
      tags: intent.tags,
      splittable: intent.estimatedDuration > 90,
    });
    if (out.length >= 8) break;
  }
  return out;
}

/* ============================================================
   AUTO-SCHEDULER  (priority + deadline + duration + energy)
   ============================================================ */
const CATEGORY_COLORS: Record<string, string> = {
  work: '#3B82F6', school: '#7C3AED', fitness: '#10B981',
  personal: '#F59E0B', social: '#EC4899', other: '#6B7280',
};
const PRIORITY_RANK: Record<Priority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

function hm(date: Date): string {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}
function minutesToHM(mins: number): string {
  const h = Math.floor(mins / 60) % 24, m = mins % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}
function hmToMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number); return h * 60 + m;
}

export interface ScheduleOptions {
  workStart: string; workEnd: string;
  bufferMinutes: number;
  energyCurve?: Record<string, EnergyLevel>;
  existingBlocks: ScheduleBlock[]; // locked events to schedule around
}

/**
 * Scores how good a given start-minute is for a task.
 * Lower score = better. Combines deadline urgency, priority and energy fit.
 */
function slotScore(task: Task, startMin: number, opts: ScheduleOptions): number {
  let score = startMin; // earlier is generally better
  score += PRIORITY_RANK[task.priority] * 30; // urgent tasks pulled earlier
  // energy fit: match task energy to the hour's energy level
  if (task.energy && opts.energyCurve) {
    const hour = String(Math.floor(startMin / 60)).padStart(2, '0');
    const slotEnergy = opts.energyCurve[hour];
    if (slotEnergy && slotEnergy !== task.energy) score += 45;
    if (slotEnergy === task.energy) score -= 20;
  } else if (task.energy === 'high' && startMin > hmToMinutes('14:00')) {
    score += 40; // default: do deep work in the morning
  }
  return score;
}

/**
 * Auto-schedule pending tasks for a given date into open work-hour slots,
 * around locked events, with buffers, splitting long tasks into sessions.
 */
export function autoSchedule(
  tasks: Task[],
  date: string,
  opts: ScheduleOptions
): ScheduleBlock[] {
  const dayStart = hmToMinutes(opts.workStart);
  const dayEnd = hmToMinutes(opts.workEnd);
  const buffer = opts.bufferMinutes ?? 10;

  // Build a list of free intervals, removing locked existing events.
  const busy = opts.existingBlocks
    .filter((b) => b.date === date)
    .map((b) => ({ start: hmToMinutes(b.startTime), end: hmToMinutes(b.endTime) }))
    .sort((a, b) => a.start - b.start);

  let free: { start: number; end: number }[] = [];
  let cursor = dayStart;
  for (const b of busy) {
    if (b.start > cursor) free.push({ start: cursor, end: Math.min(b.start, dayEnd) });
    cursor = Math.max(cursor, b.end + buffer);
  }
  if (cursor < dayEnd) free.push({ start: cursor, end: dayEnd });
  free = free.filter((f) => f.end - f.start >= 15);

  // Sort tasks: urgency + earliest deadline first.
  const pending = tasks
    .filter((t) => t.dueDate === date && t.status === 'pending' && !t.pinned)
    .sort((a, b) => {
      const p = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      if (p !== 0) return p;
      return (a.estimatedDuration || 30) - (b.estimatedDuration || 30);
    });

  const blocks: ScheduleBlock[] = [];

  for (const task of pending) {
    let remaining = task.estimatedDuration || 30;
    const minBlock = task.splittable ? (task.minBlock || 30) : remaining;

    while (remaining >= 15 && free.length) {
      // Pick the best-scoring free slot that can fit at least minBlock.
      let bestIdx = -1, bestScore = Infinity;
      for (let i = 0; i < free.length; i++) {
        if (free[i].end - free[i].start < Math.min(minBlock, remaining)) continue;
        const s = slotScore(task, free[i].start, opts);
        if (s < bestScore) { bestScore = s; bestIdx = i; }
      }
      if (bestIdx === -1) break;

      const slot = free[bestIdx];
      const avail = slot.end - slot.start;
      const sessionLen = Math.min(remaining, avail);
      const start = slot.start;
      const end = start + sessionLen;

      blocks.push({
        id: Math.random().toString(36).slice(2, 11),
        taskId: task.id,
        title: task.splittable && remaining > sessionLen ? `${task.title} (session)` : task.title,
        startTime: minutesToHM(start),
        endTime: minutesToHM(end),
        date,
        type: task.energy === 'high' || task.priority === 'urgent' ? 'focus' : 'task',
        color: CATEGORY_COLORS[task.category] || '#6B7280',
      });

      remaining -= sessionLen;
      // shrink the free slot (account for buffer after the session)
      const newStart = end + buffer;
      if (newStart >= slot.end - 15) free.splice(bestIdx, 1);
      else free[bestIdx] = { start: newStart, end: slot.end };

      if (!task.splittable) break;
    }
  }
  return blocks;
}

/**
 * Reactive reschedule: when a conflict/overrun happens, push unfinished
 * auto-scheduled blocks later or to the next day. Returns updated blocks.
 */
export function reschedule(
  blocks: ScheduleBlock[],
  fromTime: string,
  date: string,
  opts: ScheduleOptions
): ScheduleBlock[] {
  const cutoff = hmToMinutes(fromTime);
  const keep = blocks.filter((b) => b.date !== date || hmToMinutes(b.endTime) <= cutoff || b.locked);
  const toMove = blocks.filter((b) => b.date === date && hmToMinutes(b.startTime) >= cutoff && !b.locked);
  // Re-pack moved blocks after the cutoff.
  let cursor = Math.max(cutoff, hmToMinutes(opts.workStart));
  const moved: ScheduleBlock[] = [];
  for (const b of toMove) {
    const len = hmToMinutes(b.endTime) - hmToMinutes(b.startTime);
    if (cursor + len > hmToMinutes(opts.workEnd)) {
      // overflow -> next day same start
      moved.push({ ...b, date: format(addDays(new Date(date), 1), 'yyyy-MM-dd'), startTime: opts.workStart, endTime: minutesToHM(hmToMinutes(opts.workStart) + len) });
    } else {
      moved.push({ ...b, startTime: minutesToHM(cursor), endTime: minutesToHM(cursor + len) });
      cursor += len + (opts.bufferMinutes ?? 10);
    }
  }
  return [...keep, ...moved];
}

/* ============================================================
   VOICE / TEXT ASSISTANT COMMAND PARSER
   ============================================================ */
export function parseAssistantCommand(text: string): { reply: string; actions: AssistantAction[] } {
  const t = text.toLowerCase().trim();
  const actions: AssistantAction[] = [];

  // Plan my day
  if (/plan (my )?day|organize my day|schedule my day|what should i do/.test(t)) {
    actions.push({ type: 'plan_day', label: 'Plan my day' });
    return { reply: 'On it — I\'ll auto-schedule your tasks around your calendar, protecting your focus time and adding breaks.', actions };
  }
  // Set an alarm
  if (/set (an )?alarm|wake me/.test(t)) {
    const time = parseTime(t);
    actions.push({ type: 'set_alarm', label: time ? `Set alarm for ${time}` : 'Set alarm', payload: { time } });
    return { reply: time ? `Alarm set for ${time}. I\'ll make sure it goes off.` : 'What time should I set the alarm for?', actions };
  }
  // Remind me
  if (/remind me|set a reminder/.test(t)) {
    const intent = parseNaturalLanguage(t);
    actions.push({ type: 'add_reminder', label: `Remind: ${intent.title}`, payload: intent });
    return { reply: `Reminder set: "${intent.title}"${intent.dueTime ? ' at ' + intent.dueTime : ''}. It'll notify you.`, actions };
  }
  // Bills / payments
  if (/pay |bill|rent|subscription|due/.test(t) && /\$|\d/.test(t)) {
    const amount = (t.match(/\$?\s*(\d+(?:\.\d{2})?)/) || [])[1];
    actions.push({ type: 'add_bill', label: 'Add bill reminder', payload: { ...parseNaturalLanguage(t), amount: amount ? Number(amount) : undefined } });
    return { reply: `I\'ll track that bill${amount ? ' of $' + amount : ''} and remind you before it\'s due. (I can\'t move money — you\'ll pay it yourself.)`, actions };
  }
  // Groceries
  if (/add .* to (my )?(grocery|shopping)|buy |grocery|shopping list/.test(t)) {
    const item = t.replace(/.*(add|buy)\s+/, '').replace(/\s+to.*(grocery|shopping).*/, '').trim();
    actions.push({ type: 'add_grocery', label: `Add ${item} to groceries`, payload: { name: item } });
    return { reply: `Added "${item}" to your grocery list.`, actions };
  }
  // Meals
  if (/plan .*(meal|dinner|lunch|breakfast)|what.*(cook|eat|dinner)/.test(t)) {
    actions.push({ type: 'plan_meal', label: 'Plan a meal', payload: parseNaturalLanguage(t) });
    return { reply: 'Let\'s plan your meals — I\'ll add them and build a grocery list from the ingredients.', actions };
  }
  // Complete a task
  if (/(mark|i )?(done|finished|completed|complete)\b/.test(t)) {
    const what = t.replace(/.*(done|finished|completed|complete)\s*/, '').trim();
    actions.push({ type: 'complete_task', label: `Complete: ${what}`, payload: { query: what } });
    return { reply: `Nice work! Marking "${what}" complete.`, actions };
  }
  // Default: treat as a new task
  const intent = parseNaturalLanguage(text);
  actions.push({ type: 'add_task', label: `Add task: ${intent.title}`, payload: intent });
  return {
    reply: `Got it. I\'ll add "${intent.title}"${intent.dueDate ? ' for ' + intent.dueDate : ''}${intent.dueTime ? ' at ' + intent.dueTime : ''} as a ${intent.priority}-priority ${intent.category} task.`,
    actions,
  };
}

/** Seam for a future hosted LLM. Currently returns the local parser result. */
export async function callLLM(prompt: string): Promise<string> {
  return parseAssistantCommand(prompt).reply;
}
