import { addDays, keyOf, today, weekdayOf } from "./format";

const cache = new Map();

function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  return keyOf(year, Math.floor((h + l - 7 * m + 114) / 31) - 1, ((h + l - 7 * m + 114) % 31) + 1);
}

const firstMonday = (y, m0) => keyOf(y, m0, 1 + ((1 - new Date(Date.UTC(y, m0, 1)).getUTCDay() + 7) % 7));

function lastMonday(y, m0) {
  const last = new Date(Date.UTC(y, m0 + 1, 0));
  return keyOf(y, m0, last.getUTCDate() - ((last.getUTCDay() - 1 + 7) % 7));
}

export function irelandPublicHolidays(year) {
  if (!cache.has(year)) {
    const feb1 = keyOf(year, 1, 1);
    cache.set(year, [
      { date: keyOf(year, 0, 1), name: "New Year's Day" },
      { date: weekdayOf(feb1) === 5 ? feb1 : firstMonday(year, 1), name: "St Brigid's Day" },
      { date: keyOf(year, 2, 17), name: "St Patrick's Day" },
      { date: addDays(easterSunday(year), 1), name: "Easter Monday" },
      { date: firstMonday(year, 4), name: "May Public Holiday" },
      { date: firstMonday(year, 5), name: "June Public Holiday" },
      { date: firstMonday(year, 7), name: "August Public Holiday" },
      { date: lastMonday(year, 9), name: "October Public Holiday" },
      { date: keyOf(year, 11, 25), name: "Christmas Day" },
      { date: keyOf(year, 11, 26), name: "St Stephen's Day" },
    ]);
  }
  return cache.get(year);
}

export const publicHolidayForDate = (key) => irelandPublicHolidays(Number(key.slice(0, 4))).find((h) => h.date === key) || null;
export const isWeekend = (key) => [0, 6].includes(weekdayOf(key));

export function productionDayInfo(key) {
  const holiday = publicHolidayForDate(key);
  const weekend = isWeekend(key);
  return { available: !weekend && !holiday, weekend, holiday };
}

export function nextProductionDay(key = today()) {
  let k = key;
  while (!productionDayInfo(k).available) k = addDays(k, 1);
  return k;
}

export const nextProductionDayAfter = (key = today()) => nextProductionDay(addDays(key, 1));

export function workingDaysBetween(from, to) {
  if (!from || !to || from > to) return 0;
  let n = 0;
  for (let k = from; k <= to; k = addDays(k, 1)) if (productionDayInfo(k).available) n += 1;
  return n;
}

export function publicHolidaysBetween(from, to) {
  if (!from || !to || from > to) return [];
  const out = [];
  for (let y = Number(from.slice(0, 4)); y <= Number(to.slice(0, 4)); y += 1) {
    irelandPublicHolidays(y).forEach((h) => {
      if (h.date >= from && h.date <= to && !isWeekend(h.date)) out.push(h);
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
