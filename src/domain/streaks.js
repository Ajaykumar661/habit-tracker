// The streak engine.
//
// Everything about "how am I doing" is computed here and nowhere else — no
// component recalculates any of it. Each function is pure and takes the day
// to reason from, so tests can stand anywhere in time without mocking clocks.
//
// The central change from the original daily-only engine: a streak is a run
// of consecutive *scheduled* days, not consecutive calendar days. A habit due
// Mon/Wed/Fri is not broken by an unmarked Tuesday, but is broken by an
// unmarked Wednesday. For a daily habit this reduces exactly to the old
// behaviour, which is why existing chronicles read the same after upgrading.

import { habitToday, diffDays } from '../lib/dates';

const EMPTY = new Set();
import { isScheduledOn, getScheduledDays } from './schedule';
import { computeShields } from './shields';

/**
 * Runs of consecutive scheduled days that were completed. Oldest first.
 *
 * A day in `shielded` does not end the run, but does not join it either:
 * nothing was actually done, so it earns no tally mark. The run simply
 * continues on the far side of it.
 */
export function computeSegments(habit, completedDates, today = habitToday(), shielded = EMPTY) {
  const done = new Set(completedDates || []);
  const segments = [];
  let current = null;
  for (const date of getScheduledDays(habit, today)) {
    if (done.has(date)) {
      if (current) current.dates.push(date);
      else segments.push((current = { dates: [date] }));
    } else if (!shielded.has(date)) {
      current = null;                    // a missed scheduled day ends the run
    }
  }
  return segments;
}

/**
 * Index of the run still in progress within `segments`, or -1.
 *
 * Takes already-computed data so a caller can derive both the segments and
 * the live one from a single pass — recomputing would hand back different
 * object instances, and anything comparing by identity (such as splitting
 * out `prevSegments`) would silently count the live run twice.
 *
 * A streak survives today being unmarked — the day isn't over. It does not
 * survive any earlier scheduled day being unmarked.
 */
export function findCurrentSegmentIndex(segments, scheduled, today, shielded = EMPTY) {
  if (!segments.length || !scheduled.length) return -1;

  const lastIdx = segments.length - 1;
  const last = segments[lastIdx];
  const lastDone = last.dates[last.dates.length - 1];

  if (lastDone === scheduled[scheduled.length - 1]) return lastIdx;   // nothing outstanding

  // Anything left outstanding must be today (the day isn't over) or a day a
  // shield already covered. Anything else is a genuine break.
  const after = scheduled.slice(scheduled.indexOf(lastDone) + 1);
  return after.every((d) => d === today || shielded.has(d)) ? lastIdx : -1;
}

/** The run still in progress, or null. */
export function getCurrentSegment(habit, completedDates, today = habitToday(), shielded) {
  const cover = shielded ?? computeShields(habit, completedDates, today).shieldedDates;
  const scheduled = getScheduledDays(habit, today);
  const segments = computeSegments(habit, completedDates, today, cover);
  const idx = findCurrentSegmentIndex(segments, scheduled, today, cover);
  return idx === -1 ? null : segments[idx];
}

export function calculateCurrentStreak(habit, completedDates, today = habitToday()) {
  return getCurrentSegment(habit, completedDates, today)?.dates.length ?? 0;
}

export function calculateLongestStreak(habit, completedDates, today = habitToday()) {
  return computeSegments(habit, completedDates, today)
    .reduce((max, s) => Math.max(max, s.dates.length), 0);
}

/** Scheduled days already past (today excluded) with nothing logged. */
export function getMissedDays(habit, completedDates, today = habitToday()) {
  const done = new Set(completedDates || []);
  return getScheduledDays(habit, today).filter((d) => d < today && !done.has(d));
}

/** Share of scheduled days completed, 0-100. */
export function calculateCompletionRate(habit, completedDates, today = habitToday()) {
  const scheduled = getScheduledDays(habit, today);
  if (!scheduled.length) return 0;
  const done = new Set(completedDates || []);
  const hit = scheduled.filter((d) => done.has(d)).length;
  return Math.round((hit / scheduled.length) * 100);
}

/**
 * Consecutive scheduled days completed since the last miss — the "climbing
 * back" counter. Distinct from the current streak in that it is measured
 * from the break rather than from the beginning of the run.
 */
export function calculateRecoveryStreak(habit, completedDates, today = habitToday()) {
  const missed = getMissedDays(habit, completedDates, today);
  if (!missed.length) return 0;
  const lastMiss = missed[missed.length - 1];
  const done = new Set(completedDates || []);
  return getScheduledDays(habit, today)
    .filter((d) => d > lastMiss && d <= today && done.has(d))
    .length;
}

function lastLapsedRun(segments) {
  const last = segments[segments.length - 1];
  if (!last) return null;
  return { days: last.dates.length, endedOn: last.dates[last.dates.length - 1] };
}

/** A run that has lapsed: exists, but is no longer live. */
export function getBrokenStreak(habit, completedDates, today = habitToday()) {
  if (calculateCurrentStreak(habit, completedDates, today) > 0) return null;
  const cover = computeShields(habit, completedDates, today).shieldedDates;
  return lastLapsedRun(computeSegments(habit, completedDates, today, cover));
}

/** Earliest date a streak of `days` was ever reached. */
export function getAchievementDate(routine, days, today = habitToday()) {
  let earliest = null;
  for (const seg of computeSegments(routine, routine?.completed, today)) {
    if (seg.dates.length >= days) {
      const candidate = seg.dates[days - 1];
      if (!earliest || candidate < earliest) earliest = candidate;
    }
  }
  return earliest;
}

export function chunk5(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 5) out.push(arr.slice(i, i + 5));
  return out;
}

/**
 * Everything the UI reads, in one pass.
 * `routine` is a habit plus its completed date list (see useTallyWallState).
 */
export function computeStats(routine, today = habitToday()) {
  if (!routine) {
    return {
      segments: [], currentStreak: 0, currentSegment: null, bestStreak: 0, brokenStreak: null,
      totalCompleted: 0, daysSinceStart: 0, scheduledDays: 0, completionPct: 0,
      missedDays: 0, recoveryStreak: 0, prevSegments: [],
      shields: { earned: 0, spent: [], available: 0, shieldedDates: new Set() },
    };
  }

  const completed = routine.completed || [];
  const scheduled = getScheduledDays(routine, today);
  const shields = computeShields(routine, completed, today);
  const cover = shields.shieldedDates;
  const segments = computeSegments(routine, completed, today, cover);
  const currentIdx = findCurrentSegmentIndex(segments, scheduled, today, cover);
  const currentSegment = currentIdx === -1 ? null : segments[currentIdx];
  const currentStreak = currentSegment?.dates.length ?? 0;

  return {
    segments,
    currentSegment,
    currentStreak,
    prevSegments: segments.filter((_, i) => i !== currentIdx),
    bestStreak: Math.max(currentStreak, ...segments.map((s) => s.dates.length), 0),
    brokenStreak: currentStreak > 0 ? null : lastLapsedRun(segments),
    shields,
    // Every logged day counts as a tally, including any on an unscheduled
    // day — doing extra shouldn't be invisible just because it wasn't due.
    totalCompleted: completed.length,
    daysSinceStart: routine.startDate ? Math.max(1, diffDays(today, routine.startDate) + 1) : 0,
    scheduledDays: scheduled.length,
    completionPct: calculateCompletionRate(routine, completed, today),
    // A shielded day was still a day the habit wasn't done. The stat stays
    // truthful; the shield shows up separately rather than hiding the gap.
    missedDays: getMissedDays(routine, completed, today).length,
    recoveryStreak: calculateRecoveryStreak(routine, completed, today),
  };
}

export { isScheduledOn, getScheduledDays };
