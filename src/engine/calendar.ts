/**
 * Calendar helpers for the simulation.
 * TIME ZONE DECISION: simulation times are interpreted in the user's LOCAL time zone (Date local getters),
 * so "pickups late afternoon" means late afternoon on the user's clock. Korean users are on KST anyway.
 */

const HOUR = 3.6e6;
export { HOUR };
export const DAY = 24 * HOUR;
export const MINUTE = 6e4;

/** Korean public holidays (fixed + lunar ones hard-coded for 2025–2028, incl. substitute days). Format MM-DD / YYYY-MM-DD. */
const FIXED = new Set(['01-01', '03-01', '05-05', '06-06', '08-15', '10-03', '10-09', '12-25']);
const DATED = new Set([
  // 2025
  '2025-01-27', '2025-01-28', '2025-01-29', '2025-01-30', '2025-03-03', '2025-05-06', '2025-06-03',
  '2025-10-05', '2025-10-06', '2025-10-07', '2025-10-08',
  // 2026
  '2026-02-16', '2026-02-17', '2026-02-18', '2026-03-02', '2026-05-25', '2026-06-03', '2026-08-17',
  '2026-09-24', '2026-09-25', '2026-09-26', '2026-10-05',
  // 2027
  '2027-02-06', '2027-02-07', '2027-02-08', '2027-02-09', '2027-05-13', '2027-08-16',
  '2027-09-14', '2027-09-15', '2027-09-16', '2027-10-04', '2027-10-11', '2027-12-27',
  // 2028
  '2028-01-26', '2028-01-27', '2028-01-28', '2028-05-02', '2028-10-02', '2028-10-04', '2028-10-05',
]);

const pad = (n: number) => String(n).padStart(2, '0');

/** Holiday calendar to use: Korean (default, the simulation) or US federal holidays (US carriers). */
export type HolidayCountry = 'KR' | 'US';

/** n-th (1-based) weekday `wd` (0=Sun) of month `m` (0-based); n = -1 → last one. */
function nthWeekday(y: number, m: number, wd: number, n: number): number {
  if (n > 0) {
    const first = new Date(y, m, 1).getDay();
    return 1 + ((wd - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(y, m + 1, 0);
  return lastDay.getDate() - ((lastDay.getDay() - wd + 7) % 7);
}

/** US federal holidays of year y as 'MM-DD' (fixed-date ones moved to Fri/Mon when they fall on a weekend). */
function usHolidays(y: number): Set<string> {
  const out = new Set<string>();
  const fixed = (m: number, d: number) => {
    const wd = new Date(y, m, d).getDay();
    const obs = new Date(y, m, d + (wd === 6 ? -1 : wd === 0 ? 1 : 0));
    if (obs.getFullYear() === y) out.add(`${pad(obs.getMonth() + 1)}-${pad(obs.getDate())}`);
  };
  const nth = (m: number, wd: number, n: number) => out.add(`${pad(m + 1)}-${pad(nthWeekday(y, m, wd, n))}`);
  fixed(0, 1); //     New Year's Day
  nth(0, 1, 3); //    Martin Luther King Jr. Day
  nth(1, 1, 3); //    Presidents' Day
  nth(4, 1, -1); //   Memorial Day
  fixed(5, 19); //    Juneteenth
  fixed(6, 4); //     Independence Day
  nth(8, 1, 1); //    Labor Day
  nth(9, 1, 2); //    Columbus Day
  fixed(10, 11); //   Veterans Day
  nth(10, 4, 4); //   Thanksgiving
  fixed(11, 25); //   Christmas
  // New Year's Day on a Saturday is observed on Dec 31 of the previous year.
  if (new Date(y + 1, 0, 1).getDay() === 6) out.add('12-31');
  return out;
}
const US_CACHE = new Map<number, Set<string>>();

export function isHoliday(d: Date, country: HolidayCountry = 'KR'): boolean {
  const md = `${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (country === 'US') {
    const y = d.getFullYear();
    if (!US_CACHE.has(y)) US_CACHE.set(y, usHolidays(y));
    return US_CACHE.get(y)!.has(md);
  }
  return FIXED.has(md) || DATED.has(`${d.getFullYear()}-${md}`);
}

/** Sundays and public holidays: hubs rest, no trunk moves / deliveries. Korean calendar unless `country` says US. */
export function isRestDay(d: Date, country: HolidayCountry = 'KR'): boolean {
  return d.getDay() === 0 || isHoliday(d, country);
}

/** Local midnight of the day containing `t`, shifted by `days` (DST-safe via Date constructor). */
export function dayStart(t: number, days = 0): number {
  const d = new Date(t);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days).getTime();
}

/** Local time on the day of `dayMs` at fractional hour `h` (may exceed 24 → next day). */
export function atHour(dayMs: number, h: number): number {
  const d = new Date(dayMs);
  const whole = Math.floor(h);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), whole, Math.round((h - whole) * 60)).getTime();
}

/** Local fractional hour of day. */
export function hourOf(t: number): number {
  const d = new Date(t);
  return d.getHours() + d.getMinutes() / 60;
}

export function isNight(t: number): boolean {
  const h = hourOf(t);
  return h >= 22 || h < 6;
}

/** Whole calendar days between the local dates of a and b (b - a). */
export function dayDiff(a: number, b: number): number {
  return Math.round((dayStart(b) - dayStart(a)) / DAY);
}

/** Next local day (after the day containing t) that is not a rest day; returns its midnight. */
export function nextWorkingDay(t: number, country: HolidayCountry = 'KR'): number {
  for (let k = 1; k < 15; k++) {
    const d = dayStart(t, k);
    if (!isRestDay(new Date(d), country)) return d;
  }
  return dayStart(t, 1);
}

/** Hours between a and b excluding time on rest days (approximate, hour granularity). */
export function workingHoursBetween(a: number, b: number): number {
  if (b <= a) return 0;
  let total = 0;
  let t = a;
  while (t < b) {
    const end = Math.min(b, dayStart(t, 1));
    if (!isRestDay(new Date(t))) total += (end - t) / HOUR;
    t = end;
  }
  return total;
}
