// The achievement catalogue.
//
// Each entry declares what it needs and how to measure it; nothing is stored.
// An achievement is unlocked when its measure reaches its target, so the set
// is always consistent with history and can never drift out of sync with the
// record — the same reasoning as XP and shields.
//
// Adding one means adding a definition here. Nothing else changes.

import { ACHIEVEMENTS as STREAK_MILESTONES } from '../lib/achievements';
import { isComplete, valueOf } from './completion';
import { isScheduledOn } from './schedule';
import { computeShields } from './shields';
import { classifyDay, DAY, earliestStart } from './perfectDays';
import { computeSegments } from './streaks';
import { habitToday, datesBetween, diffDays } from '../lib/dates';

const HOUR_LATE = 22;      // "after 10pm"
const HOUR_EARLY = 9;      // "before 9am"

/**
 * Facts the catalogue is scored against. Built in one pass over history so
 * a dozen achievements don't each walk the record separately.
 */
export function buildAchievementContext(habits, completions, today = habitToday()) {
  const active = (habits || []).filter(Boolean);
  const ctx = {
    totalCompletions: 0,
    bestStreak: 0,
    perfectDays: 0,
    bestPerfectRun: 0,
    lateCompletions: 0,
    earlyCompletions: 0,
    durationSeconds: 0,
    shieldsSpent: 0,
    longestComeback: 0,
    distinctHabits: active.length,
    firstDate: null,
    daysTracked: 0,
  };
  if (!active.length) return ctx;

  const start = earliestStart(active);
  if (!start || start > today) return ctx;
  ctx.firstDate = start;
  ctx.daysTracked = diffDays(today, start) + 1;

  for (const habit of active) {
    const byDate = completions?.[habit.id] || {};
    for (const [date, rec] of Object.entries(byDate)) {
      if (!isComplete(habit, rec)) continue;
      ctx.totalCompletions += 1;
      if (habit.type === 'duration') ctx.durationSeconds += valueOf(habit, rec);
      // Migrated v1 records have no completedAt; they are simply not counted
      // toward time-of-day achievements rather than guessed at.
      if (rec?.completedAt) {
        const hour = new Date(rec.completedAt).getHours();
        if (hour >= HOUR_LATE || hour < 4) ctx.lateCompletions += 1;
        if (hour < HOUR_EARLY) ctx.earlyCompletions += 1;
      }
    }

    const view = { ...habit, completed: Object.keys(byDate).filter((d) => isComplete(habit, byDate[d])) };
    for (const seg of computeSegments(view, view.completed, today)) {
      ctx.bestStreak = Math.max(ctx.bestStreak, seg.dates.length);
    }
    const shields = computeShields(view, view.completed, today);
    ctx.shieldsSpent += shields.spent.length;
    ctx.longestComeback = Math.max(ctx.longestComeback, longestComebackFor(view, today));
  }

  let run = 0;
  for (const date of datesBetween(start, today)) {
    const kind = classifyDay(active, completions, date);
    if (kind === DAY.PERFECT) {
      ctx.perfectDays += 1;
      ctx.bestPerfectRun = Math.max(ctx.bestPerfectRun, (run += 1));
    } else if (kind === DAY.IMPERFECT) {
      run = 0;
    }
  }
  return ctx;
}

/** Longest run of completions that followed a gap of 3+ scheduled misses. */
function longestComebackFor(view, today) {
  const done = new Set(view.completed);
  let best = 0;
  let gap = 0;
  let run = 0;
  let afterLongGap = false;

  for (const date of datesBetween(view.startDate, today)) {
    if (!isScheduledOn(view, date)) continue;
    if (done.has(date)) {
      if (gap >= 3) afterLongGap = true;
      gap = 0;
      if (afterLongGap) best = Math.max(best, (run += 1));
    } else if (date < today) {
      gap += 1;
      run = 0;
      if (gap >= 3) afterLongGap = false;   // a new absence, not a comeback yet
    }
  }
  return best;
}

/**
 * The catalogue. `measure` reads the context; `target` is what unlocks it.
 * `hidden` entries stay unnamed until earned.
 */
export const CATALOGUE = [
  { id: 'first-blood', title: 'FIRST BLOOD', desc: 'Complete your first quest', icon: 'star',
    target: 1, measure: (c) => c.totalCompletions },
  { id: 'century', title: 'CENTURY', desc: 'One hundred quests completed', icon: 'calendar',
    target: 100, measure: (c) => c.totalCompletions },
  { id: 'unbroken', title: 'UNBROKEN', desc: 'Hold a streak for thirty days', icon: 'shield',
    target: 30, measure: (c) => c.bestStreak },
  { id: 'perfect-week', title: 'PERFECT WEEK', desc: 'Seven perfect days in a row', icon: 'crown',
    target: 7, measure: (c) => c.bestPerfectRun },
  { id: 'the-scholar', title: 'THE SCHOLAR', desc: 'Fifty hours logged on timed quests', icon: 'key',
    target: 50 * 3600, measure: (c) => c.durationSeconds, format: (v) => `${Math.floor(v / 3600)}H` },
  { id: 'night-owl', title: 'NIGHT OWL', desc: 'Finish twenty-five quests after 10pm', icon: 'star',
    target: 25, measure: (c) => c.lateCompletions },
  { id: 'dawn-rider', title: 'DAWN RIDER', desc: 'Finish twenty-five quests before 9am', icon: 'star',
    target: 25, measure: (c) => c.earlyCompletions },
  { id: 'comeback', title: 'THE RETURN', desc: 'Rebuild three days after an absence', icon: 'shield',
    target: 3, measure: (c) => c.longestComeback },
  { id: 'warden', title: 'WARDEN OF THE WALL', desc: 'Let a shield save a streak', icon: 'shield',
    target: 1, measure: (c) => c.shieldsSpent, hidden: true },
  { id: 'many-paths', title: 'MANY PATHS', desc: 'Keep four quests at once', icon: 'key',
    target: 4, measure: (c) => c.distinctHabits },
  // The original streak milestones, folded in rather than kept as a parallel
  // system, so one catalogue describes everything.
  ...STREAK_MILESTONES.map((m) => ({
    id: `streak-${m.days}`,
    title: m.code,
    desc: `Hold a streak for ${m.days} days`,
    icon: m.icon,
    target: m.days,
    measure: (c) => c.bestStreak,
    days: m.days,
  })),
];

/** Score the catalogue. Unlocked first, then closest to unlocking. */
export function evaluateAchievements(habits, completions, today = habitToday()) {
  const ctx = buildAchievementContext(habits, completions, today);
  return CATALOGUE.map((def) => {
    const current = Math.max(0, def.measure(ctx) || 0);
    const unlocked = current >= def.target;
    return {
      ...def,
      current,
      unlocked,
      pct: Math.min(100, Math.round((current / def.target) * 100)),
      progressText: def.format
        ? `${def.format(current)} / ${def.format(def.target)}`
        : `${current} / ${def.target}`,
    };
  }).sort((a, b) => (b.unlocked - a.unlocked) || (b.pct - a.pct));
}
