// Streak shields.
//
// Reaching a milestone earns a shield. Missing a scheduled day spends one
// automatically, and the run survives. With none left, the run breaks as it
// always did.
//
// Like XP, shields are DERIVED from history rather than stored as a counter.
// One chronological pass decides what was earned and what was spent, so the
// same history always yields the same answer and there is no tally to drift
// or be edited. Critically, this also means a shielded day is never written
// back as "completed" — the record still says the day was missed, and the
// shield is an interpretation laid over it. The chronicle stays honest.

import { habitToday } from '../lib/dates';
import { getScheduledDays } from './schedule';

export const SHIELD_RULES = {
  // Run lengths that grant a shield, each awarded once per unbroken run.
  milestones: [7, 30, 100],
  // Held shields are capped so a long run can't bank an untouchable buffer.
  maxHeld: 3,
};

/**
 * Walk the habit's scheduled days and work out its shields.
 *
 * @returns {{
 *   earned: number,
 *   spent: Array<{date: string, streakAtTime: number}>,
 *   available: number,
 *   shieldedDates: Set<string>,
 * }}
 */
export function computeShields(habit, completedDates, today = habitToday()) {
  const done = new Set(completedDates || []);
  const result = { earned: 0, spent: [], available: 0, shieldedDates: new Set() };
  if (!habit) return result;

  let held = 0;
  let run = 0;
  let awarded = new Set();          // milestones already granted in this run

  for (const date of getScheduledDays(habit, today)) {
    if (done.has(date)) {
      run += 1;
      for (const m of SHIELD_RULES.milestones) {
        if (run >= m && !awarded.has(m)) {
          awarded.add(m);
          result.earned += 1;
          held = Math.min(SHIELD_RULES.maxHeld, held + 1);
        }
      }
      continue;
    }

    // Today being unmarked is not yet a miss — the day isn't over.
    if (date === today) continue;

    if (held > 0) {
      held -= 1;
      result.spent.push({ date, streakAtTime: run });
      result.shieldedDates.add(date);
      // The run survives but does not grow: nothing was actually done.
    } else {
      run = 0;
      awarded = new Set();
      // Shields already held are kept through a break; they were earned.
    }
  }

  result.available = held;
  return result;
}

/** The most recent shield spend, or null. */
export function latestShieldSpend(shields) {
  return shields?.spent?.length ? shields.spent[shields.spent.length - 1] : null;
}
