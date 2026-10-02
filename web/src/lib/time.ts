/**
 * Timezone-safe date helpers.
 *
 * Calendar dates are represented as "date keys" (YYYY-MM-DD) and wall-clock
 * times as "HH:MM". Date-key arithmetic is done in UTC so it is never affected
 * by DST or the server's own timezone. Conversions between a wall-clock time in
 * an IANA timezone and an absolute instant use Intl, so they are correct on
 * both the server and the client.
 */

export const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;

const pad = (n: number) => String(n).padStart(2, "0");

export function isDateKey(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export function isHHMM(s: unknown): s is string {
  return typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function keyFromParts(y: number, m: number, d: number) {
  return `${y}-${pad(m)}-${pad(d)}`;
}

export function parseKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
}

export function addDaysKey(key: string, days: number) {
  const { y, m, d } = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return keyFromParts(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** 0 = Sunday */
export function weekdayOfKey(key: string) {
  const { y, m, d } = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function diffDaysKey(a: string, b: string) {
  const pa = parseKey(a);
  const pb = parseKey(b);
  return Math.round((Date.UTC(pa.y, pa.m - 1, pa.d) - Date.UTC(pb.y, pb.m - 1, pb.d)) / 86400000);
}

export function toMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function fromMinutes(min: number) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(min)));
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}

/* ── Zone-aware conversions (work anywhere) ───────────────────────────── */

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(timeZone: string) {
  let f = fmtCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    fmtCache.set(timeZone, f);
  }
  return f;
}

export function safeTimeZone(tz: string | null | undefined) {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Wall-clock parts of an instant in a timezone. */
export function zonedParts(date: Date, timeZone: string) {
  const parts = partsFormatter(safeTimeZone(timeZone)).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  const y = get("year");
  const m = get("month");
  const d = get("day");
  const h = get("hour") % 24;
  const mi = get("minute");
  return { y, m, d, h, mi, key: keyFromParts(y, m, d), hhmm: `${pad(h)}:${pad(mi)}` };
}

function offsetMinutesAt(date: Date, timeZone: string) {
  const p = zonedParts(date, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  return Math.round((asUtc - Math.floor(date.getTime() / 60000) * 60000) / 60000);
}

/** Absolute instant for a wall-clock date+time in a timezone. */
export function zonedTimeToUtc(key: string, hhmm: string, timeZone: string): Date {
  const { y, m, d } = parseKey(key);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const tz = safeTimeZone(timeZone);
  let off = offsetMinutesAt(new Date(guess), tz);
  let result = guess - off * 60000;
  // Second pass handles DST transitions between the guess and the result.
  const off2 = offsetMinutesAt(new Date(result), tz);
  if (off2 !== off) {
    off = off2;
    result = guess - off * 60000;
  }
  return new Date(result);
}

/* ── Browser-local helpers (client components) ────────────────────────── */

export function localTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function localKey(date: Date = new Date()) {
  return keyFromParts(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function localHHMM(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function localDate(key: string, hhmm = "00:00") {
  const { y, m, d } = parseKey(key);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi, 0, 0);
}

export function startOfLocalDay(date: Date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function endOfLocalDay(date: Date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

/** Convert extracted {date,time} into a due_at ISO + all-day flag (browser local). */
export function dueFromParts(date: string | null | undefined, time: string | null | undefined) {
  if (!date || !isDateKey(date)) return { due_at: null as string | null, due_all_day: false };
  if (time && isHHMM(time)) return { due_at: localDate(date, time).toISOString(), due_all_day: false };
  return { due_at: localDate(date, "23:59").toISOString(), due_all_day: true };
}

export function clientClock() {
  const now = new Date();
  return {
    today: localKey(now),
    now: now.toISOString(),
    timezone: localTimeZone(),
    utc_offset_minutes: -now.getTimezoneOffset(),
  };
}

/* ── Formatting ───────────────────────────────────────────────────────── */

export function formatTime(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function formatTimeRange(start: string, end: string) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

export function formatDuration(minutes: number | null | undefined) {
  if (!minutes) return "";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatDateKey(key: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return localDate(key).toLocaleDateString(undefined, opts);
}

/** Human label for a due date relative to today: "Today 3:00 PM", "Tomorrow", "Thu", "Mar 4". */
export function formatDue(dueAt: string, allDay: boolean, now: Date = new Date()) {
  const due = new Date(dueAt);
  const diff = diffDaysKey(localKey(due), localKey(now));
  const time = allDay ? "" : ` ${formatTime(due)}`;
  if (diff === 0) return `Today${time}`;
  if (diff === 1) return `Tomorrow${time}`;
  if (diff === -1) return `Yesterday${time}`;
  if (diff > 1 && diff < 7) return `${due.toLocaleDateString(undefined, { weekday: "short" })}${time}`;
  const sameYear = due.getFullYear() === now.getFullYear();
  return `${due.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) })}${time}`;
}

export function greeting(date: Date = new Date()) {
  const h = date.getHours();
  if (h < 5) return "Good evening";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}
