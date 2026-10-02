import { zonedParts } from "../time";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function to12h(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** "Thu Oct 8, 2:00 PM–3:00 PM" in a given timezone (server-safe). */
export function formatInZone(startIso: string, endIso: string, tz: string) {
  const s = zonedParts(new Date(startIso), tz);
  const e = zonedParts(new Date(endIso), tz);
  const wd = WD[new Date(Date.UTC(s.y, s.m - 1, s.d)).getUTCDay()];
  const month = new Date(Date.UTC(s.y, s.m - 1, 1)).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  return `${wd} ${month} ${s.d}, ${to12h(s.hhmm)}–${e.key === s.key ? to12h(e.hhmm) : `${e.key} ${to12h(e.hhmm)}`}`;
}
