// XP, levels and titles.
//
// The single most important decision here: XP is DERIVED from completion
// history, never accumulated in a stored counter.
//
// A stored counter is exploitable by definition — complete, undo, complete
// again and the number climbs forever. Deriving it makes farming impossible
// by construction rather than by guarding every mutation: undo removes the
// completion record, so the XP it was worth simply stops being counted. No
// reconciliation, no drift, and the same history always yields the same
// total on any device.
//
// The cost is recomputation, which is bounded and cheap: one pass over the
// days a habit has existed. Callers memoise it.

import { isComplete } from './completion';
import { isPerfectDay, earliestStart, perfectDayStats } from './perfectDays';
import { habitToday, datesBetween } from '../lib/dates';

/** Tunable economy. Kept together so balance is one edit, not a hunt. */
export const XP_RULES = {
  perCompletion: { easy: 10, normal: 20, hard: 30 },
  perfectDayBonus: 50,
  // A perfect day needs something to actually have been due; a day with
  // nothing scheduled is not an achievement.
  minScheduledForPerfectDay: 1,
};

/**
 * Cumulative XP required to *reach* a level.
 *
 * Linear + quadratic: early levels arrive quickly enough to feel like
 * progress in the first week, later ones stretch out so a title means
 * something. Level 1 is the start, so it costs nothing.
 */
export function totalXpForLevel(level) {
  const l = Math.max(1, Math.floor(level)) - 1;
  return 50 * l + 25 * l * l;
}

/** Highest level fully paid for by `xp`. */
export function levelForXp(xp) {
  const total = Math.max(0, Math.floor(xp));
  // Closed form inverse of the curve above, then corrected for rounding.
  let level = Math.floor((-50 + Math.sqrt(2500 + 100 * total)) / 50) + 1;
  while (totalXpForLevel(level + 1) <= total) level += 1;
  while (level > 1 && totalXpForLevel(level) > total) level -= 1;
  return level;
}

/** Titles by level. Configurable: the highest threshold at or below wins. */
export const TITLES = [
  { level: 1, title: 'APPRENTICE' },
  { level: 5, title: 'SQUIRE' },
  { level: 10, title: 'PAGE' },
  { level: 20, title: 'KNIGHT' },
  { level: 30, title: 'WARDEN' },
  { level: 50, title: 'COMMANDER' },
  { level: 75, title: 'LORD' },
  { level: 100, title: 'GRANDMASTER' },
];

/** The rank for a level. `titles` lets a theme name its own ranks. */
export function titleForLevel(level, titles = TITLES) {
  let title = titles[0].title;
  for (const t of titles) if (level >= t.level) title = t.title;
  return title;
}

/** XP a single completed day of this habit is worth. */
export function xpForCompletion(habit) {
  return XP_RULES.perCompletion[habit?.difficulty] ?? XP_RULES.perCompletion.normal;
}

/**
 * Walk the whole history once and total everything up.
 * @returns {{ total:number, fromCompletions:number, fromPerfectDays:number,
 *             perfectDays:string[], byDate:Record<string,number> }}
 */
export function computeXpBreakdown(habits, completions, today = habitToday()) {
  const active = (habits || []).filter(Boolean);
  const result = {
    total: 0, fromCompletions: 0, fromPerfectDays: 0, perfectDays: [], byDate: {},
  };
  if (!active.length) return result;

  const earliest = earliestStart(active);
  if (!earliest || earliest > today) return result;

  for (const date of datesBetween(earliest, today)) {
    let dayXp = 0;
    for (const habit of active) {
      // Completions logged on a day the habit wasn't due still count — doing
      // more than was asked shouldn't be worth nothing.
      if (isComplete(habit, completions[habit.id]?.[date])) dayXp += xpForCompletion(habit);
    }
    result.fromCompletions += dayXp;

    if (isPerfectDay(active, completions, date)) {
      dayXp += XP_RULES.perfectDayBonus;
      result.fromPerfectDays += XP_RULES.perfectDayBonus;
      result.perfectDays.push(date);
    }
    if (dayXp) result.byDate[date] = dayXp;
    result.total += dayXp;
  }
  return result;
}

// Re-exported so callers have one import for the progression picture.
export { isPerfectDay };

/** Everything the UI needs about progression, in one object. */
export function computeProgression(habits, completions, today = habitToday()) {
  const breakdown = computeXpBreakdown(habits, completions, today);
  const xp = breakdown.total;
  const level = levelForXp(xp);
  const floor = totalXpForLevel(level);
  const ceiling = totalXpForLevel(level + 1);
  const span = Math.max(1, ceiling - floor);

  return {
    xp,
    level,
    title: titleForLevel(level),
    xpIntoLevel: xp - floor,
    xpForNextLevel: span,
    xpRemaining: Math.max(0, ceiling - xp),
    progressPct: Math.min(100, Math.round(((xp - floor) / span) * 100)),
    perfectDays: breakdown.perfectDays,
    perfectDayCount: breakdown.perfectDays.length,
    perfect: perfectDayStats(habits, completions, today),
    fromCompletions: breakdown.fromCompletions,
    fromPerfectDays: breakdown.fromPerfectDays,
    byDate: breakdown.byDate,
  };
}
