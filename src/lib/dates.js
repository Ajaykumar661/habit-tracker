// The one place dates are reasoned about.
//
// Everything works on local-time "YYYY-MM-DD" strings, never UTC. A user in
// IST marking a habit at 00:30 must get *their* date, not yesterday's in
// London — so nothing here goes near toISOString() for date derivation.
//
// "Habit day" vs calendar day: with a cutoff configured (Phase 22), the small
// hours still belong to the day before. habitDateOf() is the single answer to
// "which day does this instant count as", and streaks, the calendar, XP and
// notifications must all ask it rather than deriving their own.

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function todayStr() {
  return toDateStr(new Date());
}

export function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);          // local midnight, not UTC
}

export function diffDays(aStr, bStr) {
  const a = parseDateStr(aStr);
  const b = parseDateStr(bStr);
  // Compare local midnights via UTC to sidestep DST: on a 23- or 25-hour day
  // the raw millisecond gap isn't a whole number of days.
  const au = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bu = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((au - bu) / 86400000);
}

/** Calendar arithmetic that survives month, year and DST boundaries. */
export function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);            // rolls months/years correctly
  return toDateStr(d);
}

/** 0 = Sunday … 6 = Saturday, matching Date#getDay. */
export function weekdayOf(dateStr) {
  return parseDateStr(dateStr).getDay();
}

/** Inclusive list of date strings from `from` to `to`. */
export function datesBetween(fromStr, toStr) {
  const out = [];
  if (fromStr > toStr) return out;
  for (let d = fromStr; d <= toStr; d = addDays(d, 1)) out.push(d);
  return out;
}

// ---------------------------------------------------------------- habit day

export const MIN_CUTOFF_HOUR = 0;
export const MAX_CUTOFF_HOUR = 6;

export function clampCutoff(hour) {
  const n = Number(hour);
  if (!Number.isFinite(n)) return 0;
  return Math.min(MAX_CUTOFF_HOUR, Math.max(MIN_CUTOFF_HOUR, Math.trunc(n)));
}

/**
 * Which habit-day an instant belongs to.
 *
 * With cutoffHour = 2, anything before 02:00 is still "yesterday" — so a
 * 01:30 completion closes out the previous day rather than silently starting
 * a new one and breaking a streak the user thinks they kept.
 */
export function habitDateOf(instant, cutoffHour = 0) {
  const cutoff = clampCutoff(cutoffHour);
  const d = new Date(instant);
  if (cutoff > 0) d.setHours(d.getHours() - cutoff);
  return toDateStr(d);
}

/** Today, as the habit engine understands it. */
export function habitToday(cutoffHour = 0, now = new Date()) {
  return habitDateOf(now, cutoffHour);
}

const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export function formatDateLabel(dateStr) {
  const d = parseDateStr(dateStr);
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

export const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
export const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
