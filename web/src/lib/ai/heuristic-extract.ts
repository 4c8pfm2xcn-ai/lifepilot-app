/**
 * On-device extraction engine.
 *
 * Used when no ANTHROPIC_API_KEY is configured. It is deliberately
 * conservative: dates are only produced when the text names one explicitly,
 * vague phrases ("next week", "soon") are flagged for confirmation rather than
 * guessed, and anything it cannot classify is kept as a note.
 */
import type { Category, ExtractedItem, ExtractedKind, Extraction, Priority } from "../types";
import { addDaysKey, fromMinutes, isDateKey, keyFromParts, parseKey, weekdayOfKey, WEEKDAYS } from "../time";
import { uid } from "../id";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const WORD_NUMBERS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, half: 0.5 };

const ACTION_VERBS = [
  "call", "email", "text", "message", "buy", "pick up", "finish", "submit", "send", "pay", "book", "schedule", "review",
  "write", "read", "study", "clean", "fix", "meet", "prepare", "prep", "order", "renew", "return", "cancel", "check",
  "update", "follow up", "draft", "plan", "start", "complete", "file", "print", "sign", "reply", "respond", "ask",
  "remind", "go to", "drop off", "practice", "research", "organize", "make", "get",
];

const CATEGORY_KEYWORDS: Record<Exclude<Category, "other">, string[]> = {
  school: ["homework", "assignment", "essay", "exam", "quiz", "midterm", "final", "class", "lecture", "chemistry", "physics", "math", "calculus", "biology", "history", "professor", "semester", "study", "lab report", "thesis", "course", "teacher", "school", "university", "college", "tutor", "syllabus", "problem set", "pset"],
  work: ["meeting", "boss", "manager", "client", "report", "presentation", "deck", "standup", "stand-up", "sprint", "colleague", "coworker", "office", "slides", "jira", "team", "1:1", "one-on-one", "performance review", "work", "deadline", "proposal", "quarterly"],
  business: ["supplier", "invoice", "customer", "sales", "revenue", "launch", "startup", "investor", "pitch", "inventory", "order", "vendor", "contract", "marketing", "business", "shop", "store", "product", "pricing", "llc", "taxes", "accountant", "website", "brand"],
  health: ["gym", "workout", "run ", "running", "doctor", "dentist", "therapy", "therapist", "meds", "medication", "prescription", "yoga", "sleep", "diet", "physio", "vitamins", "checkup", "check-up", "appointment", "health", "hospital", "pharmacy"],
  personal: ["mom", "dad", "mother", "father", "family", "friend", "birthday", "groceries", "grocery", "laundry", "clean", "rent", "bills", "car", "home", "dinner", "gift", "sister", "brother", "wife", "husband", "partner", "kids", "dog", "cat", "vacation", "trip", "haircut"],
};

const EVENT_WORDS = ["meeting", "appointment", "dentist", "doctor", "dinner", "lunch", "breakfast", "party", "lecture", "interview", "game", "concert", "flight", "wedding", "session", "call with", "zoom", "exam", "match", "practice", "class", "standup", "stand-up", "1:1", "coffee with", "date night", "reservation", "checkup", "check-up"];
const IDEA_PATTERN = /\b(idea|what if|maybe (?:we|i) (?:could|should)|could build|brainstorm|concept|someday i|it would be cool|thought:)\b/i;
const TASK_PATTERN = /\b(need to|have to|must|should|gotta|got to|remember to|don't forget|dont forget|remind me|todo|to-do|to do|due|deadline|homework|assignment)\b/i;

const DURATION_DEFAULTS: [RegExp, number][] = [
  [/\b(call|phone|ring)\b/, 15],
  [/\b(email|text|reply|respond|message)\b/, 10],
  [/\b(essay|thesis|paper|report|proposal|deck|presentation)\b/, 120],
  [/\b(homework|assignment|problem set|pset|study)\b/, 60],
  [/\b(workout|gym|run|yoga)\b/, 45],
  [/\b(groceries|grocery|shopping)\b/, 45],
  [/\b(pay|renew|book|order|sign)\b/, 15],
];

export interface HeuristicClock {
  today: string; // YYYY-MM-DD
}

/* ── Segmentation ─────────────────────────────────────────────────────── */

export function splitClauses(text: string): string[] {
  const verbs = ACTION_VERBS.map((v) => v.replace(/ /g, "\\s+")).join("|");
  const normalized = text
    .replace(/\r/g, "")
    .replace(/^\s*(?:[-*•▪◦]|\d+[.)]|\[\s?[x ]?\s?\])\s+/gim, "\n")
    .replace(/;\s*/g, "\n")
    .replace(/([.!?])\s+(?=[A-Z0-9])/g, "$1\n")
    .replace(new RegExp(`,?\\s+(?:and|&)\\s+(?:also\\s+)?(?:i\\s+)?(?:need|have|must|should|got|gotta)\\s+to\\s+`, "gi"), "\n")
    .replace(new RegExp(`,?\\s+(?:and|&|then|plus)\\s+(?:also\\s+)?(?=(?:${verbs})\\b)`, "gi"), "\n")
    .replace(/,\s+(?:also|plus)\s+/gi, "\n");
  return normalized
    .split("\n")
    .map((s) => s.trim().replace(/^[,.\s]+|[,\s]+$/g, ""))
    .filter((s) => s.replace(/[^a-z0-9]/gi, "").length >= 3);
}

/* ── Date / time detection ────────────────────────────────────────────── */

interface DateHit {
  date: string | null;
  ambiguity: string | null;
  match: string | null;
}

function nextWeekday(today: string, target: number) {
  const cur = weekdayOfKey(today);
  let diff = (target - cur + 7) % 7;
  if (diff === 0) diff = 7;
  return addDaysKey(today, diff);
}

function validDate(y: number, m: number, d: number) {
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Choose the next future occurrence of month/day relative to today. */
function upcomingMonthDay(today: string, m: number, d: number, explicitYear?: number) {
  const { y } = parseKey(today);
  if (explicitYear) return validDate(explicitYear, m, d) ? keyFromParts(explicitYear, m, d) : null;
  if (!validDate(y, m, d) && !validDate(y + 1, m, d)) return null;
  const thisYear = keyFromParts(y, m, d);
  return thisYear >= today ? thisYear : keyFromParts(y + 1, m, d);
}

export function detectDate(clause: string, clock: HeuristicClock): DateHit {
  const t = clause.toLowerCase();
  const { today } = clock;
  let m: RegExpMatchArray | null;

  if ((m = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/))) {
    const k = `${m[1]}-${m[2]}-${m[3]}`;
    return isDateKey(k) && validDate(+m[1], +m[2], +m[3]) ? { date: k, ambiguity: null, match: m[0] } : { date: null, ambiguity: null, match: null };
  }
  if ((m = t.match(/\bday after tomorrow\b/))) return { date: addDaysKey(today, 2), ambiguity: null, match: m[0] };
  if ((m = t.match(/\b(today|tonight|this (?:morning|afternoon|evening)|eod|end of (?:the )?day)\b/))) return { date: today, ambiguity: null, match: m[0] };
  if ((m = t.match(/\b(tomorrow|tmrw|tmr|tomorow)\b/))) return { date: addDaysKey(today, 1), ambiguity: null, match: m[0] };
  if ((m = t.match(/\bin (\d+|a|an|one|two|three|four|five|six|seven|ten) (day|days|week|weeks)\b/))) {
    const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORD_NUMBERS[m[1]] ?? 1;
    const days = m[2].startsWith("week") ? n * 7 : n;
    return { date: addDaysKey(today, days), ambiguity: null, match: m[0] };
  }

  const monthRe = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
  if ((m = t.match(new RegExp(`\\b${monthRe}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`)))) {
    const mon = MONTHS.indexOf(m[1].slice(0, 3)) + 1;
    const k = upcomingMonthDay(today, mon, Number(m[2]), m[3] ? Number(m[3]) : undefined);
    if (k) return { date: k, ambiguity: null, match: m[0] };
  }
  if ((m = t.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${monthRe}(?:,?\\s+(\\d{4}))?\\b`)))) {
    const mon = MONTHS.indexOf(m[2].slice(0, 3)) + 1;
    const k = upcomingMonthDay(today, mon, Number(m[1]), m[3] ? Number(m[3]) : undefined);
    if (k) return { date: k, ambiguity: null, match: m[0] };
  }
  if ((m = t.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/))) {
    const yr = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : undefined;
    const k = upcomingMonthDay(today, Number(m[1]), Number(m[2]), yr);
    if (k) {
      const ambiguous = Number(m[1]) <= 12 && Number(m[2]) <= 12 && m[1] !== m[2];
      return { date: k, ambiguity: ambiguous ? `"${m[0]}" was read as month/day.` : null, match: m[0] };
    }
  }

  const dayRe = "(sun|mon|tues?|wed(?:nes)?|thu(?:rs?)?|fri|sat(?:ur)?)(?:day)?";
  if ((m = t.match(new RegExp(`\\b(next|this|on|by|until|before)?\\s*${dayRe}\\b`)))) {
    const abbrev = m[2].slice(0, 3);
    const target = WEEKDAYS.findIndex((w) => w.startsWith(abbrev));
    if (target >= 0) {
      const curr = weekdayOfKey(today);
      const name = WEEKDAYS[target][0].toUpperCase() + WEEKDAYS[target].slice(1);
      if (m[1] === "next") {
        const d = nextWeekday(today, target);
        const plus = addDaysKey(d, 7);
        return { date: plus, ambiguity: `"next ${name}" can mean ${name} this coming week or the week after — please confirm.`, match: m[0] };
      }
      if (target === curr) {
        if (m[1] === "this") return { date: today, ambiguity: null, match: m[0] };
        return { date: addDaysKey(today, 7), ambiguity: `Today is ${name} — did you mean today or next ${name}?`, match: m[0] };
      }
      return { date: nextWeekday(today, target), ambiguity: null, match: m[0] };
    }
  }

  if ((m = t.match(/\b(?:on )?the (\d{1,2})(?:st|nd|rd|th)\b/))) {
    const { y, m: mon, d } = parseKey(today);
    const day = Number(m[1]);
    let k: string | null = null;
    if (day >= d && validDate(y, mon, day)) k = keyFromParts(y, mon, day);
    else {
      const nm = mon === 12 ? 1 : mon + 1;
      const ny = mon === 12 ? y + 1 : y;
      if (validDate(ny, nm, day)) k = keyFromParts(ny, nm, day);
    }
    if (k) return { date: k, ambiguity: `Assumed "${m[0].trim()}" refers to ${k}.`, match: m[0] };
  }

  const vague = t.match(/\b(next week|this week|this weekend|next weekend|next month|end of (?:the )?(?:week|month)|soon|later|sometime|someday|asap)\b/);
  if (vague) {
    return { date: null, ambiguity: `"${vague[1]}" isn't a specific date — add one if this has a deadline.`, match: vague[0] };
  }
  return { date: null, ambiguity: null, match: null };
}

interface TimeHit {
  time: string | null;
  end: string | null;
  match: string | null;
  vague: string | null;
}

function to24(h: number, min: number, mer: string | undefined) {
  let hh = h;
  if (mer) {
    const pm = mer.startsWith("p");
    if (pm && hh < 12) hh += 12;
    if (!pm && hh === 12) hh = 0;
  }
  return fromMinutes(hh * 60 + min);
}

export function detectTime(clause: string): TimeHit {
  const t = clause.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/\b(?:from\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)?\s*(?:-|–|to|until)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.)\b/))) {
    const endMer = m[6].replace(/\./g, "");
    const startMer = (m[3] ?? "").replace(/\./g, "") || endMer;
    const h1 = Number(m[1]);
    const h4 = Number(m[4]);
    if (h1 <= 12 && h4 <= 12) {
      return { time: to24(h1, Number(m[2] ?? 0), startMer), end: to24(h4, Number(m[5] ?? 0), endMer), match: m[0], vague: null };
    }
  }
  if ((m = t.match(/\b(noon|midday)\b/))) return { time: "12:00", end: null, match: m[0], vague: null };
  if ((m = t.match(/\bmidnight\b/))) return { time: "23:59", end: null, match: m[0], vague: null };
  if ((m = t.match(/\b(?:at|@|by|around)?\s*(\d{1,2}):(\d{2})\s*(am|pm|a\.m\.|p\.m\.)?/))) {
    const h = Number(m[1]);
    const mi = Number(m[2]);
    if (h < 24 && mi < 60) return { time: to24(h, mi, m[3]?.replace(/\./g, "")), end: null, match: m[0], vague: null };
  }
  if ((m = t.match(/\b(?:at|@|by|around)?\s*(\d{1,2})\s*(am|pm|a\.m\.|p\.m\.)/))) {
    const h = Number(m[1]);
    if (h >= 1 && h <= 12) return { time: to24(h, 0, m[2].replace(/\./g, "")), end: null, match: m[0], vague: null };
  }
  if ((m = t.match(/\bat (\d{1,2})\b(?!\s*(?:min|hour|hr|%|\/))/))) {
    const h = Number(m[1]);
    if (h >= 1 && h <= 12) {
      return { time: null, end: null, match: null, vague: `"at ${h}" has no am/pm.` };
    }
  }
  const vague = t.match(/\b(morning|afternoon|evening|tonight|lunchtime)\b/);
  return { time: null, end: null, match: null, vague: vague ? null : null };
}

/* ── Classification ───────────────────────────────────────────────────── */

export function detectCategory(text: string): Category {
  const t = ` ${text.toLowerCase()} `;
  let best: Category = "other";
  let bestScore = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS) as [Category, string[]][]) {
    const score = words.reduce((s, w) => (t.includes(w) ? s + (w.length > 5 ? 2 : 1) : s), 0);
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

export function detectPriority(text: string, date: string | null, today: string): Priority {
  const t = text.toLowerCase();
  if (/\b(urgent|asap|immediately|right away|critical|emergency)\b|!!/.test(t)) return "urgent";
  if (/\b(important|high priority|must|top priority|crucial)\b/.test(t)) return "high";
  if (/\b(someday|whenever|low priority|eventually|no rush|if i have time)\b/.test(t)) return "low";
  if (date && date <= today) return "high";
  return "normal";
}

export function detectDuration(text: string): number | null {
  const t = text.toLowerCase();
  let m = t.match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h)\b(?:\s*(?:and\s*)?(\d+)\s*(?:min|mins|minutes|m)\b)?/);
  if (m) return Math.round(parseFloat(m[1]) * 60 + (m[2] ? Number(m[2]) : 0));
  m = t.match(/(\d+)\s*(?:min|mins|minutes)\b/);
  if (m) return Number(m[1]);
  m = t.match(/\b(an|a|one|two|three|half an?)\s+(hours?|hrs?|minutes?)\b/);
  if (m) {
    const n = m[1].startsWith("half") ? 0.5 : WORD_NUMBERS[m[1]] ?? 1;
    return m[2].startsWith("h") ? Math.round(n * 60) : Math.round(n);
  }
  return null;
}

function defaultDuration(text: string): number | null {
  const t = text.toLowerCase();
  for (const [re, mins] of DURATION_DEFAULTS) if (re.test(t)) return mins;
  return null;
}

function detectKind(clause: string, hasTime: boolean): ExtractedKind {
  if (IDEA_PATTERN.test(clause)) return "idea";
  const t = clause.toLowerCase().replace(/^[a-z][a-z .'-]{0,24}:\s+/, "");
  const eventy = EVENT_WORDS.some((w) => t.includes(w));
  const due = /\b(due|deadline|submit|turn in|hand in)\b/.test(t);
  if (eventy && !due && (hasTime || /\b(appointment|meeting|interview|flight|wedding|reservation|exam)\b/.test(t))) return "event";
  if (TASK_PATTERN.test(t)) return "task";
  const verbs = ACTION_VERBS.map((v) => v.replace(/ /g, "\\s+")).join("|");
  if (new RegExp(`^(?:(?:please|pls|can you|could you|also|and)\\s+)*(?:${verbs})\\b`, "i").test(t.trim())) return "task";
  if (hasTime && eventy) return "event";
  if (detectDuration(t) !== null || /\b(gym|workout|run|groceries|laundry|homework)\b/.test(t)) return "task";
  return "note";
}

/* ── Title cleanup ────────────────────────────────────────────────────── */

const LEAD_INS = [
  /^(?:hey|hi|ok|okay|so|also|and|plus|then|oh)[,!]?\s+/i,
  /^(?:please\s+)?(?:remember|don'?t forget|dont forget|remind me|reminder|note to self|todo|to-do|to do)(?:\s+(?:that|to|about))?[:,]?\s+/i,
  /^(?:i|we)\s+(?:also\s+)?(?:need|have|must|should|gotta|got|want)\s+to\s+/i,
  /^(?:i|we)\s+(?:have|has|got)\s+(?:a|an|my|the)?\s*/i,
  /^(?:need|have|must|got)\s+to\s+/i,
  /^(?:can|could|would)\s+you\s+(?:please\s+)?/i,
  /^please\s+/i,
  /^[a-z][a-z .'-]{0,24}:\s+/i, // "Sam: ..." chat prefixes
];

export function cleanTitle(clause: string, removals: (string | null)[]): string {
  let s = clause.trim();
  for (let i = 0; i < 3; i++) for (const re of LEAD_INS) s = s.replace(re, "");
  for (const r of removals) {
    if (!r) continue;
    const esc = r.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\s*(?:\\b(?:due|by|on|at|before|until|for|from|this|next|is)\\s+)*${esc}`, "i"), " ");
  }
  s = s
    .replace(/\b(?:for|takes?|about)?\s*(?:\d+(?:\.\d+)?\s*(?:hours?|hrs?|h|minutes?|mins?)\b|(?:an|a|one|two|half an?)\s+(?:hours?|minutes?)\b)/gi, " ")
    .replace(/\b(?:it'?s|is)?\s*(?:urgent|asap|important|high priority|low priority)\b/gi, " ")
    .replace(/\s+\b(?:due|by|on|at|before|is|which is)\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,.:;-]+|[\s,.:;!?-]+$/g, "")
    .trim();
  if (!s) s = clause.trim();
  s = s.length > 120 ? `${s.slice(0, 117).trimEnd()}…` : s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/* ── Main entry ───────────────────────────────────────────────────────── */

export function heuristicExtract(text: string, clock: HeuristicClock): Extraction {
  const clauses = splitClauses(text);
  const items: ExtractedItem[] = [];

  for (const clause of clauses.slice(0, 12)) {
    const dateHit = detectDate(clause, clock);
    const timeHit = detectTime(clause);
    const kind = detectKind(clause, !!timeHit.time);
    const durMatch = detectDuration(clause);
    const title = cleanTitle(clause, [timeHit.match, dateHit.match]);
    const ambiguities = [dateHit.ambiguity, timeHit.vague].filter(Boolean) as string[];
    let time = timeHit.time;
    if (time && !dateHit.date && kind !== "note") ambiguities.push("A time was mentioned without a date.");
    if (!dateHit.date) time = null;
    if (kind === "event" && !time) ambiguities.push("No start time was given for this event.");
    const hasDeadline = kind === "task" && !!dateHit.date;
    const estimated = kind === "task" ? durMatch ?? defaultDuration(clause) : kind === "event" ? durMatch : null;

    items.push({
      id: uid(),
      kind,
      title,
      description: null,
      category: detectCategory(clause),
      priority: kind === "idea" || kind === "note" ? "low" : detectPriority(clause, dateHit.date, clock.today),
      estimated_minutes: estimated,
      date: dateHit.date,
      time,
      end_time: dateHit.date && timeHit.end ? timeHit.end : null,
      has_deadline: hasDeadline,
      needs_confirmation: ambiguities.length > 0,
      ambiguity: ambiguities.length ? ambiguities.join(" ") : null,
      status: "pending",
    });
  }

  return {
    summary: summarize(items),
    items,
    source: "heuristic",
    notice: "Organized on-device. Connect an Anthropic API key for full AI understanding.",
    processed_at: new Date().toISOString(),
  };
}

export function summarize(items: ExtractedItem[]) {
  if (!items.length) return "Nothing actionable found — saved as a note.";
  const counts = items.reduce<Record<string, number>>((acc, i) => ((acc[i.kind] = (acc[i.kind] ?? 0) + 1), acc), {});
  const parts = Object.entries(counts).map(([k, n]) => `${n} ${k}${n > 1 ? "s" : ""}`);
  const review = items.filter((i) => i.needs_confirmation).length;
  return `Found ${parts.join(", ")}${review ? ` · ${review} need${review > 1 ? "" : "s"} your confirmation` : ""}.`;
}
