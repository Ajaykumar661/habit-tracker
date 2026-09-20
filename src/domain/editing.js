// Changing a quest after the fact.
//
// Editing looks harmless and is not. A completion stores the value logged,
// not the target it was judged against, so raising a target from 8 to 10
// silently re-judges every past day: eight glasses that counted yesterday
// stop counting today, and a streak can evaporate without the user ever
// touching their record.
//
// This module refuses to let that happen quietly. `editImpact` replays the
// habit under the proposed settings and reports exactly what would change,
// so the UI can say "your streak would go from 12 to 0" before anything is
// written. The user may still choose it — it is their record — but they
// choose it knowing.
//
// Two fields are not editable at all:
//
//   - `type`, because a value logged against a count means nothing when
//     re-read as a duration.
//   - `startDate`, because moving it invents or discards days the record
//     never had.

import { isComplete } from './completion';
import { computeStats } from './streaks';
import { getScheduledDays } from './schedule';
import { habitToday } from '../lib/dates';

/** Fields an edit may touch. Anything else is ignored. */
export const EDITABLE = ['name', 'difficulty', 'target', 'unit', 'schedule'];

/** Fields deliberately frozen after creation, with the reason shown to the user. */
export const FROZEN = {
  type: 'The kind of quest cannot change — past entries were recorded against it.',
  startDate: 'The start date cannot change — it would invent or discard days.',
};

/** A habit with only the editable fields replaced. */
export function applyEdit(habit, changes = {}) {
  const next = { ...habit };
  for (const key of EDITABLE) {
    if (changes[key] !== undefined) next[key] = changes[key];
  }
  return next;
}

/**
 * What this edit would do to the record, judged by replaying it.
 *
 * @returns {{
 *   changed: boolean,
 *   marksLost: string[], marksGained: string[],
 *   streakBefore: number, streakAfter: number,
 *   dueBefore: number, dueAfter: number,
 *   safe: boolean,
 * }}
 */
export function editImpact(habit, byDate, changes, today = habitToday()) {
  const next = applyEdit(habit, changes);
  const dates = Object.keys(byDate || {});

  const marksLost = [];
  const marksGained = [];
  for (const date of dates) {
    const before = isComplete(habit, byDate[date]);
    const after = isComplete(next, byDate[date]);
    if (before && !after) marksLost.push(date);
    if (!before && after) marksGained.push(date);
  }
  marksLost.sort();
  marksGained.sort();

  const viewOf = (h) => ({
    ...h,
    completed: dates.filter((d) => isComplete(h, byDate[d])).sort(),
  });
  const streakBefore = computeStats(viewOf(habit), today).currentStreak;
  const streakAfter = computeStats(viewOf(next), today).currentStreak;

  const dueBefore = getScheduledDays(habit, today).length;
  const dueAfter = getScheduledDays(next, today).length;

  return {
    changed: EDITABLE.some((k) => changes[k] !== undefined
      && JSON.stringify(changes[k]) !== JSON.stringify(habit[k])),
    marksLost,
    marksGained,
    streakBefore,
    streakAfter,
    dueBefore,
    dueAfter,
    // "Safe" means nothing already recorded is re-judged. A longer streak
    // or extra due days are fine; losing marks is what needs a warning.
    safe: marksLost.length === 0 && streakAfter >= streakBefore,
  };
}

/** Plain sentences describing an unsafe edit. Empty when nothing is at risk. */
export function impactWarnings(impact) {
  const out = [];
  if (impact.marksLost.length) {
    const n = impact.marksLost.length;
    out.push(`${n} RECORDED ${n === 1 ? 'DAY' : 'DAYS'} WOULD NO LONGER COUNT AS COMPLETE.`);
  }
  if (impact.streakAfter < impact.streakBefore) {
    out.push(`YOUR STREAK WOULD GO FROM ${impact.streakBefore} TO ${impact.streakAfter}.`);
  }
  return out;
}

/** Is another quest already called this? Comparison ignores case and padding. */
export function nameTaken(habits, name, exceptId = null) {
  const wanted = String(name || '').trim().toLowerCase();
  if (!wanted) return false;
  return (habits || []).some((h) => h
    && h.id !== exceptId
    && !h.archivedAt
    && String(h.name || '').trim().toLowerCase() === wanted);
}
