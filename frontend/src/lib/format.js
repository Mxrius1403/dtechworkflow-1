export const TIMEZONE = process.env.REACT_APP_TIMEZONE || "Europe/Dublin";

const DAY_MS = 86400000;
const toDate = (v) => new Date(typeof v === "string" && v.length === 10 ? `${v}T12:00:00Z` : v);
const pad = (n) => String(n).padStart(2, "0");

export const keyOf = (year, month0, day) => `${year}-${pad(month0 + 1)}-${pad(day)}`;

export function dateKey(value) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(value));
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const today = () => dateKey(new Date());
export const isToday = (value) => Boolean(value) && dateKey(value) === today();
export const weekdayOf = (key) => new Date(`${key}T00:00:00Z`).getUTCDay();

export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const startOfWeekKey = (key = today()) => addDays(key, -((weekdayOf(key) + 6) % 7));
export const endOfWeekKey = (key = today()) => addDays(startOfWeekKey(key), 6);

export function monthRange(key = today()) {
  const [y, m] = key.split("-").map(Number);
  return [keyOf(y, m - 1, 1), keyOf(y, m - 1, new Date(Date.UTC(y, m, 0)).getUTCDate())];
}

const fmt = (value, options) => (value ? toDate(value).toLocaleString("en-GB", { timeZone: TIMEZONE, ...options }) : "-");

export const timeOf = (v) => fmt(v, { hour: "2-digit", minute: "2-digit" });
export const nice = (v) => fmt(v, { day: "2-digit", month: "short", year: "numeric" });
export const shortDate = (v) => fmt(v, { day: "2-digit", month: "2-digit" });
export const dateTimeOf = (v) => fmt(v, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const weekdayShort = (key) => fmt(key, { weekday: "short" });
export const niceToday = () => fmt(new Date().toISOString(), { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
export const monthTitle = (year, month0) =>
  new Date(Date.UTC(year, month0, 15)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

export function localInputValue(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value || Date.now()));
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

export function minutesBetween(a, b) {
  if (!a || !b) return null;
  return Math.max(0, Math.round((new Date(b) - new Date(a)) / 60000));
}

export function formatDuration(min) {
  if (!min) return "-";
  const h = Math.floor(min / 60);
  return h ? `${h}h ${min % 60}min` : `${min % 60}min`;
}

export function calendarDaysBetween(from, to) {
  if (!from || !to) return 0;
  return Math.max(0, Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS));
}

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
