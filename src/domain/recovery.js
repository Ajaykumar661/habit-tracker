// The Rally: what happens after a streak breaks.
//
// A broken streak resets the count to zero, and zero is a discouraging place
// to stand — the work that built the run is still real, but the number no
// longer says so. The rally gives the days right after a break somewhere to
// go: a short, winnable goal that acknowledges you came back.
//
// Three rules keep it honest:
//
//   1. It is derived, never stored. Like XP and shields, it is recomputed
//      from the record, so it cannot be farmed or desynchronised.
//   2. It only appears after a run worth mourning. Missing one day of a
//      two-day habit does not need a recovery arc.
//   3. It expires. If the break was long ago, the rally is over and what
//      you have now is simply a new streak, not a comeback.

import { computeStats } from './streaks';
import { isScheduledOn, getScheduledDays } from './schedule';
import { habitToday, diffDays } from '../lib/dates';

export const RECOVERY_RULES = {
  /** Scheduled days back before the rally is won. */
  goalDays: 3,
  /** A run must have been at least this long for its loss to start a rally. */
  minLostRun: 3,
  /** After this many days, a break is history rather than something to recover from. */
  graceDays: 21,
};

/**
 * The state of the rally for one habit.
 *
 * @returns {{
 *   active: boolean, complete: boolean, daysBack: number, goal: number,
 *   pct: number, remaining: number, lostRun: number,
 *   lastMiss: string|null, dueToday: boolean,
 * }}
 */
export function getRecovery(routine, today = habitToday(), stats = null) {
  const idle = {
    active: false, complete: false, daysBack: 0, goal: RECOVERY_RULES.goalDays,
    pct: 0, remaining: RECOVERY_RULES.goalDays, lostRun: 0, lastMiss: null, dueToday: false,
  };
  if (!routine) return idle;

  const s = stats || computeStats(routine, today);
  const daysBack = s.recoveryStreak;
  const lastMiss = lastMissedDay(routine, s, today);
  if (!lastMiss) return idle;

  // How long the run that ended at that miss actually was. Without this, a
  // habit that has never held more than a day would nag about recovering.
  const lostRun = runEndingBefore(s.segments, lastMiss);
  if (lostRun < RECOVERY_RULES.minLostRun) return idle;

  // A break far enough back is no longer something to rally from.
  if (diffDays(today, lastMiss) > RECOVERY_RULES.graceDays) return idle;

  const goal = RECOVERY_RULES.goalDays;
  const complete = daysBack >= goal;
  return {
    active: true,
    complete,
    daysBack,
    goal,
    pct: Math.min(100, Math.round((daysBack / goal) * 100)),
    remaining: Math.max(0, goal - daysBack),
    lostRun,
    lastMiss,
    dueToday: isScheduledOn(routine, today),
  };
}

/** The most recent scheduled day that was missed, shields included. */
function lastMissedDay(routine, stats, today) {
  const done = new Set(routine.completed || []);
  const cover = stats.shields?.shieldedDates || new Set();
  // Today is still in play, so it is never a miss.
  const past = getScheduledDays(routine, today).filter((d) => d < today);
  for (let i = past.length - 1; i >= 0; i -= 1) {
    const date = past[i];
    if (!done.has(date) && !cover.has(date)) return date;
  }
  return null;
}

/** The length of the run that ended immediately before `date`. */
function runEndingBefore(segments, date) {
  let best = 0;
  for (const seg of segments) {
    const end = seg.dates[seg.dates.length - 1];
    if (end && end < date) best = seg.dates.length;
  }
  return best;
}

/** The line shown on the rally strip. Encouraging, never reproachful. */
export function recoveryMessage(recovery) {
  if (!recovery.active) return null;
  if (recovery.complete) return 'THE RALLY IS WON. THE WALL STANDS AGAIN.';
  if (recovery.daysBack === 0) {
    return recovery.dueToday
      ? 'ONE MARK TODAY BEGINS THE RALLY.'
      : 'THE RALLY BEGINS ON YOUR NEXT DUE DAY.';
  }
  if (recovery.remaining === 1) return 'ONE MORE DAY AND THE RALLY IS WON.';
  return `${recovery.remaining} MORE DAYS TO WIN THE RALLY.`;
}
