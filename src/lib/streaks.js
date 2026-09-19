import { diffDays, todayStr } from './dates';

// Returns array of segments: [{ dates: [sorted date strs] }], ordered oldest -> newest.
// A segment is a run of calendar-consecutive completed days.
export function computeSegments(routine) {
  const sorted = [...routine.completed].sort();
  const segments = [];
  let current = null;
  for (const d of sorted) {
    if (current && diffDays(d, current.dates[current.dates.length - 1]) === 1) {
      current.dates.push(d);
    } else {
      current = { dates: [d] };
      segments.push(current);
    }
  }
  return segments;
}

export function computeStats(routine) {
  const segments = computeSegments(routine);
  const today = todayStr();

  let currentStreak = 0;
  let currentSegment = null;
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    const lastDate = last.dates[last.dates.length - 1];
    const gap = diffDays(today, lastDate);
    if (gap === 0 || gap === 1) {
      currentStreak = last.dates.length;
      currentSegment = last;
    }
  }

  let bestStreak = 0;
  for (const seg of segments) bestStreak = Math.max(bestStreak, seg.dates.length);
  bestStreak = Math.max(bestStreak, currentStreak);

  const totalCompleted = routine.completed.length;

  const start = routine.startDate;
  const daysSinceStart = Math.max(1, diffDays(today, start) + 1);
  const completionPct = Math.min(100, Math.round((totalCompleted / daysSinceStart) * 100));
  const missedDays = Math.max(0, daysSinceStart - totalCompleted);

  const prevSegments = segments.filter((s) => s !== currentSegment);

  return {
    segments, currentStreak, currentSegment, bestStreak,
    totalCompleted, daysSinceStart, completionPct, missedDays, prevSegments,
  };
}

export function chunk5(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 5) out.push(arr.slice(i, i + 5));
  return out;
}

// Finds the earliest date a streak of `days` length was ever reached, purely
// derived from completed dates — no extra state to persist or migrate.
export function getAchievementDate(routine, days) {
  const segments = computeSegments(routine);
  let earliest = null;
  for (const seg of segments) {
    if (seg.dates.length >= days) {
      const candidate = seg.dates[days - 1];
      if (!earliest || candidate < earliest) earliest = candidate;
    }
  }
  return earliest;
}
