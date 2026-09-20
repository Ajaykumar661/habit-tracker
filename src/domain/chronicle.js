// The Chronicle: what actually happened on a given day.
//
// The calendar shows one habit's rhythm; the chronicle answers "what did I
// do on the 17th" across everything. It is a projection over stored records
// — it computes nothing new and stores nothing, so opening a day can never
// alter it.

import { progressOf, isComplete } from './completion';
import { isScheduledOn } from './schedule';
import { xpForCompletion, XP_RULES } from './xp';
import { classifyDay, DAY } from './perfectDays';
import { habitToday } from '../lib/dates';

/**
 * Everything worth showing for one day.
 *
 * @returns {{
 *   date: string,
 *   completed: Array<{habit, progress}>,
 *   missed: Array<{habit}>,
 *   pending: Array<{habit, progress}>,
 *   notScheduled: Array<{habit}>,
 *   xp: number,
 *   perfect: boolean,
 *   isFuture: boolean,
 *   kind: string,
 * }}
 */
export function getDayDetail(habits, completions, date, today = habitToday()) {
  const completed = [];
  const missed = [];
  const pending = [];
  const notScheduled = [];
  let xp = 0;

  for (const habit of habits || []) {
    if (!habit || habit.archivedAt) continue;
    if (habit.startDate && date < habit.startDate) continue;   // not yet tracked

    const record = completions?.[habit.id]?.[date];
    const progress = progressOf(habit, record);
    const due = isScheduledOn(habit, date);

    if (isComplete(habit, record)) {
      completed.push({ habit, progress, record });
      xp += xpForCompletion(habit);
    } else if (!due) {
      notScheduled.push({ habit, progress });
    } else if (date < today) {
      missed.push({ habit, progress });
    } else {
      pending.push({ habit, progress });      // today, or still to come
    }
  }

  const kind = classifyDay(habits, completions, date);
  const perfect = kind === DAY.PERFECT;
  if (perfect) xp += XP_RULES.perfectDayBonus;

  return {
    date,
    completed,
    missed,
    pending,
    notScheduled,
    xp,
    perfect,
    kind,
    isFuture: date > today,
  };
}

/** Which day of tracking this is, counting from the earliest habit start. */
export function dayNumber(habits, date) {
  const starts = (habits || []).map((h) => h?.startDate).filter(Boolean).sort();
  if (!starts.length || date < starts[0]) return null;
  // Counted inclusively: the first tracked day is Day 1.
  const from = new Date(starts[0].slice(0, 4), +starts[0].slice(5, 7) - 1, +starts[0].slice(8, 10));
  const to = new Date(date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
    - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000) + 1;
}
