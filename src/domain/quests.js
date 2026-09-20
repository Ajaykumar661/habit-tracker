// The day's quest board.
//
// Turns the habit list into "what is being asked of me today", which is a
// different question from "what habits exist". Habits due today lead; the
// rest stay reachable but out of the way, because hiding them entirely would
// make a Mon/Wed/Fri habit feel deleted on a Tuesday.
//
// This is a pure projection — it decides nothing about completion or
// scheduling, it only asks completion.js and schedule.js and arranges the
// answers.

import { progressOf } from './completion';
import { isScheduledOn, describeSchedule } from './schedule';
import { habitToday } from '../lib/dates';

/**
 * @returns {{
 *   due: Array<{habit, record, progress, due: true}>,
 *   later: Array<{habit, record, progress, due: false}>,
 *   doneCount: number,
 *   total: number,
 *   remaining: number,
 *   allComplete: boolean,
 * }}
 */
export function buildQuestBoard(habits, completions, today = habitToday()) {
  const due = [];
  const later = [];

  for (const habit of habits || []) {
    if (!habit || habit.archivedAt) continue;
    const record = completions?.[habit.id]?.[today];
    const entry = {
      habit,
      record,
      progress: progressOf(habit, record),
      due: isScheduledOn(habit, today),
      schedule: describeSchedule(habit),
    };
    (entry.due ? due : later).push(entry);
  }

  const doneCount = due.filter((e) => e.progress.complete).length;
  return {
    due,
    later,
    doneCount,
    total: due.length,
    remaining: due.length - doneCount,
    // An empty board is not a completed one — there was nothing to do.
    allComplete: due.length > 0 && doneCount === due.length,
  };
}

/** Short status line for the board's footer. */
export function questSummary(board) {
  if (!board.total) return 'NO QUESTS TODAY';
  if (board.allComplete) return 'QUEST COMPLETE';
  return `${board.doneCount} / ${board.total} COMPLETE`;
}
