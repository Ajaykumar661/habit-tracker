// Daily reminders -- and the rules that keep them from becoming nagging.
//
// A reminder is a promise not to be annoying, so the rules are the point:
//   * Off until the user turns it on.
//   * At most one a day, at the time they chose.
//   * Only when something due that day is still open. A day with nothing
//     scheduled, or one already finished, stays silent.
//   * Only a few days are ever planned ahead. The phone cannot run this code
//     when the notification fires, so the plan is made whenever the app is
//     open. If the user stops opening it, the plan simply runs out and the
//     reminders stop, rather than pleading forever.
//
// This module only decides *what* to schedule. lib/reminders.js hands the
// plan to the phone.

import { buildQuestBoard } from './quests';
import { addDays, habitToday, parseDateStr } from '../lib/dates';

/** Days planned ahead, today included. After this many unopened days: silence. */
export const REMINDER_HORIZON = 3;

export const DEFAULT_REMINDER_TIME = '20:00';
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** The half-hour choices offered in settings, 6:00 AM through 11:30 PM. */
export const REMINDER_TIMES = Array.from({ length: 36 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

/** A stored time, or the default when it is missing or malformed. */
export function reminderTimeOf(settings) {
  const t = settings?.reminderTime;
  return typeof t === 'string' && TIME_RE.test(t) ? t : DEFAULT_REMINDER_TIME;
}

/** '20:30' -> '8:30 PM', for the settings list. */
export function formatReminderTime(t) {
  const [h, m] = t.split(':').map(Number);
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** A stable numeric id per day, so a day is never scheduled twice. */
export function reminderIdFor(dateStr) {
  return Number(dateStr.replace(/-/g, ''));
}

/** The medieval wording; a theme passes its own. */
export const REMIND_WORDS = {
  title: 'TALLY WALL',
  one: (name) => `${name} still waits for today’s mark.`,
  many: (n) => `${n} quests still wait for today’s mark.`,
};

/**
 * What to schedule, as of `now`.
 * @returns {Array<{ id: number, date: string, at: Date, title: string, body: string }>}
 */
export function planReminders({ habits, completions, settings, now = new Date(), words = REMIND_WORDS }) {
  if (!settings?.reminderOn) return [];

  const [h, m] = reminderTimeOf(settings).split(':').map(Number);
  const today = habitToday(settings?.dayCutoffHour ?? 0, now);
  const plan = [];

  for (let i = 0; i < REMINDER_HORIZON; i += 1) {
    const date = addDays(today, i);
    const at = parseDateStr(date);
    at.setHours(h, m, 0, 0);
    if (at <= now) continue;                     // already past: never fire late

    // Future days have no records yet, so this is simply "what is due".
    const board = buildQuestBoard(habits, completions, date);
    if (board.total === 0 || board.allComplete) continue;

    const open = board.due.filter((e) => !e.progress.complete);
    plan.push({
      id: reminderIdFor(date),
      date,
      at,
      title: words.title,
      body: open.length === 1 ? words.one(open[0].habit.name) : words.many(open.length),
    });
  }
  return plan;
}
