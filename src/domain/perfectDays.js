// Perfect days: every habit that was due that day, done.
//
// A day with nothing scheduled is not perfect — there was nothing to be
// perfect about — but neither does it break a run of perfect days. It is
// skipped, exactly as an unscheduled day is skipped for a single habit's
// streak. Treating rest days as failures would punish people for the
// schedule they deliberately chose.

import { isComplete } from './completion';
import { isScheduledOn } from './schedule';
import { habitToday, datesBetween } from '../lib/dates';

export const DAY = { PERFECT: 'perfect', IMPERFECT: 'imperfect', NONE_DUE: 'none-due' };

/** Was every habit due on this day completed? */
export function isPerfectDay(habits, completions, date) {
  const due = (habits || []).filter((h) => isScheduledOn(h, date));
  if (!due.length) return false;
  return due.every((h) => isComplete(h, completions?.[h.id]?.[date]));
}

/** Classify a day: perfect, imperfect, or nothing was due. */
export function classifyDay(habits, completions, date) {
  const due = (habits || []).filter((h) => isScheduledOn(h, date));
  if (!due.length) return DAY.NONE_DUE;
  return due.every((h) => isComplete(h, completions?.[h.id]?.[date]))
    ? DAY.PERFECT : DAY.IMPERFECT;
}

/** The earliest day any habit was being tracked. */
export function earliestStart(habits) {
  return (habits || []).map((h) => h?.startDate).filter(Boolean).sort()[0] || null;
}

/** Every perfect day, oldest first. */
export function getPerfectDays(habits, completions, today = habitToday()) {
  const start = earliestStart(habits);
  if (!start || start > today) return [];
  return datesBetween(start, today).filter((d) => isPerfectDay(habits, completions, d));
}

/**
 * Totals for the ledger.
 * @returns {{ total:number, current:number, longest:number, days:string[] }}
 */
export function perfectDayStats(habits, completions, today = habitToday()) {
  const start = earliestStart(habits);
  if (!start || start > today) return { total: 0, current: 0, longest: 0, days: [] };

  const all = datesBetween(start, today);
  const kind = new Map(all.map((d) => [d, classifyDay(habits, completions, d)]));
  const days = all.filter((d) => kind.get(d) === DAY.PERFECT);

  let longest = 0;
  let run = 0;
  for (const d of all) {
    const k = kind.get(d);
    if (k === DAY.PERFECT) longest = Math.max(longest, (run += 1));
    else if (k === DAY.IMPERFECT) run = 0;
    // NONE_DUE: neither extends nor breaks
  }

  // Current run, walking back from today. Today still being unfinished does
  // not break it — the day isn't over yet.
  let current = 0;
  for (let i = all.length - 1; i >= 0; i--) {
    const k = kind.get(all[i]);
    if (k === DAY.PERFECT) current += 1;
    else if (k === DAY.NONE_DUE) continue;
    else if (all[i] === today) continue;
    else break;
  }

  return { total: days.length, current, longest, days };
}
