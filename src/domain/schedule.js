// When is a habit actually due?
//
// This is the single answer to "does this day count for this habit", and
// every other engine defers to it. Keeping it here is what lets a schedule
// be edited later without touching history: completion records are keyed by
// date and never reference the schedule, so changing which days are expected
// re-interprets the past rather than rewriting it.

import { weekdayOf, datesBetween, toDateStr, habitToday } from '../lib/dates';

/**
 * Is `dateStr` a day this habit is expected on?
 * Days before it started, or after it was archived, are never scheduled.
 * @param {import('./types').Habit} habit
 * @param {string} dateStr
 */
export function isScheduledOn(habit, dateStr) {
  if (!habit || !dateStr) return false;
  if (habit.startDate && dateStr < habit.startDate) return false;
  if (habit.archivedAt && dateStr > toDateStr(new Date(habit.archivedAt))) return false;

  const { frequency, weekdays } = habit.schedule || {};
  if (frequency === 'weekly') {
    // An empty weekday list means "no days chosen", which is never-due. The
    // alternative (treating it as every day) would silently invent misses.
    return Array.isArray(weekdays) && weekdays.includes(weekdayOf(dateStr));
  }
  return true;                                   // 'daily', and the default
}

/** Every scheduled date in [from, to], inclusive. */
export function scheduledDatesBetween(habit, fromStr, toStr) {
  const from = habit?.startDate && habit.startDate > fromStr ? habit.startDate : fromStr;
  return datesBetween(from, toStr).filter((d) => isScheduledOn(habit, d));
}

/** Scheduled days from the habit's start through `today`, oldest first. */
export function getScheduledDays(habit, today = habitToday()) {
  if (!habit?.startDate || habit.startDate > today) return [];
  return scheduledDatesBetween(habit, habit.startDate, today);
}

/** How many days a week this habit is expected on. */
export function daysPerWeek(habit) {
  const { frequency, weekdays } = habit?.schedule || {};
  return frequency === 'weekly' ? (weekdays?.length || 0) : 7;
}

/** Human-readable schedule, for the ledger and the quest board. */
export function describeSchedule(habit, names = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']) {
  const { frequency, weekdays } = habit?.schedule || {};
  if (frequency !== 'weekly') return 'EVERY DAY';
  const days = [...(weekdays || [])].sort();
  if (!days.length) return 'NO DAYS SET';
  if (days.length === 7) return 'EVERY DAY';
  if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return 'WEEKDAYS';
  if (days.length === 2 && days.includes(0) && days.includes(6)) return 'WEEKENDS';
  return days.map((d) => names[d]).join(' ');
}
