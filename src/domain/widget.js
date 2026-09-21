// What the home-screen widget is told.
//
// The widget lives outside the app and cannot run any of this code, so the
// app sends it a small, plain snapshot every time something changes. The
// widget then has to survive the day turning over on its own -- possibly
// for days, if the app is not opened -- so the snapshot carries just enough
// for it to stay honest:
//   * what is due on the next few days, so a new day starts at "0 / N";
//   * whether the active routine was done (or not even due) on the
//     snapshot's day, so the widget knows if the streak carries over.
// Beyond that the widget says it needs the app, rather than guessing.

import { buildQuestBoard } from './quests';
import { isScheduledOn } from './schedule';
import { addDays } from '../lib/dates';

/** Days of "what is due" sent ahead, the snapshot's own day included. */
export const WIDGET_LOOKAHEAD = 3;

/** Most marks drawn on the widget: four gates of five. */
export const WIDGET_MAX_MARKS = 20;

/** The medieval wording; a theme passes its own. */
export const WIDGET_WORDS = {
  day: 'DAY',
  done: 'DONE',
  allDone: 'ALL DONE',
  rest: 'A DAY OF REST',
  stale: 'OPEN THE WALL',
};

/**
 * @returns {{
 *   date: string, cutoffHour: number, theme: string, name: string, streak: number,
 *   activeDone: boolean, activeDue: boolean,
 *   done: number, total: number, due: Record<string, number>,
 *   words: typeof WIDGET_WORDS,
 * }}
 */
export function widgetSnapshot({ habits, completions, activeRoutine, streak, today, theme, cutoffHour = 0, words = WIDGET_WORDS }) {
  const board = buildQuestBoard(habits, completions, today);
  const due = {};
  for (let i = 0; i < WIDGET_LOOKAHEAD; i += 1) {
    const date = addDays(today, i);
    due[date] = i === 0 ? board.total : buildQuestBoard(habits, completions, date).total;
  }
  const activeDue = !!activeRoutine && isScheduledOn(activeRoutine, today);
  const activeDone = !!activeRoutine && board.due.some((e) => e.habit.id === activeRoutine.id && e.progress.complete);

  return {
    date: today,
    // so the widget turns the day at the same hour the app does
    cutoffHour,
    theme,
    name: activeRoutine?.name || '',
    streak: Math.max(0, streak || 0),
    activeDone,
    activeDue,
    done: board.doneCount,
    total: board.total,
    due,
    words: { ...words },
  };
}

/**
 * What the widget should show on `today`, given the last snapshot. This is
 * the same rule the Android widget implements (TallyWidget.java); it lives
 * here too so the rule itself is tested.
 * @returns {{ streak: number | null, done: number, total: number, stale: boolean }}
 */
export function widgetViewFor(snap, today) {
  if (snap.date === today) {
    return { streak: snap.streak, done: snap.done, total: snap.total, stale: false };
  }
  if (addDays(snap.date, 1) === today) {
    // The snapshot's day is over. Its streak survives only if that day was
    // logged, or was never asked of the routine in the first place.
    const carries = snap.activeDone || !snap.activeDue;
    return { streak: carries ? snap.streak : null, done: 0, total: snap.due?.[today] ?? snap.total, stale: false };
  }
  return { streak: null, done: 0, total: snap.due?.[today] ?? 0, stale: true };
}
