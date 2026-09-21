// What the record can honestly say about itself.
//
// Two rules hold this module together:
//
//   1. Nothing is claimed without enough evidence. Every pattern carries the
//      sample it was drawn from, and anything below MIN_SAMPLE is not
//      reported at all. A habit tracker that tells you Tuesdays are your
//      worst day after two Tuesdays is worse than one that stays quiet.
//   2. Nothing here scolds. Findings are phrased as observations about the
//      record, not verdicts about the person.

import { isComplete } from './completion';
import { isScheduledOn, getScheduledDays } from './schedule';
import { classifyDay, DAY, earliestStart } from './perfectDays';
import { computeXpBreakdown } from './xp';
import { habitToday, datesBetween, addDays, weekdayOf, diffDays, WEEKDAY_NAMES } from '../lib/dates';

/** Below this many scheduled days, a weekday tells us nothing. */
export const MIN_SAMPLE = 4;
/** A gap this wide between best and worst is worth mentioning. */
const NOTABLE_GAP = 0.25;

const rate = (done, due) => (due > 0 ? done / due : 0);
const pct = (x) => Math.round(x * 100);

/**
 * How findings and verdicts are worded. This is the medieval voice; a theme
 * passes its own. Every entry observes the record, none judges the person.
 */
export const REPORT_WORDS = {
  bestDay: (day, p) => `${day} IS YOUR STRONGEST DAY \u2014 ${p}% KEPT.`,
  worstDay: (day, p) => `${day} ASKS THE MOST OF YOU \u2014 ${p}% KEPT.`,
  weekendBetter: (we, wk) => `WEEKENDS SUIT YOU \u2014 ${we}% AGAINST ${wk}% IN THE WEEK.`,
  weekBetter: (wk, we) => `THE WEEK HOLDS FIRMER THAN THE WEEKEND \u2014 ${wk}% AGAINST ${we}%.`,
  gaining: (now, before) => `YOU ARE GAINING \u2014 ${now}% THIS WEEK, UP FROM ${before}%.`,
  harder: (now, before) => `THIS WEEK RAN HARDER \u2014 ${now}%, DOWN FROM ${before}%.`,
  steadiest: (name, p) => `${name} IS YOUR STEADIEST OATH \u2014 ${p}% KEPT.`,
  hardest: (name) => `${name} HAS BEEN THE HARDEST TO HOLD.`,
  notWritten: 'THE WEEK IS NOT YET WRITTEN.',
  flawless: 'A FLAWLESS WEEK. THE KEEP STANDS UNTOUCHED.',
  strong: 'A STRONG WEEK. THE WALLS HELD.',
  held: 'THE WEEK WAS HELD, IF NOT EASILY.',
  hard: 'A HARD WEEK. WHAT WAS KEPT STILL COUNTS.',
  quiet: 'A QUIET WEEK. THE WALL WAITS, PATIENT AS EVER.',
};

/**
 * How each weekday has gone, across every habit.
 * @returns {Array<{weekday:number, name:string, due:number, done:number, rate:number, enough:boolean}>}
 */
export function weekdayBreakdown(habits, completions, today = habitToday()) {
  const active = (habits || []).filter(Boolean);
  const rows = WEEKDAY_NAMES.map((name, weekday) => ({
    weekday, name, due: 0, done: 0, rate: 0, enough: false,
  }));

  const start = earliestStart(active);
  if (!start) return rows;

  for (const habit of active) {
    const byDate = completions?.[habit.id] || {};
    // Today is still in play, so it counts as neither kept nor missed.
    for (const date of getScheduledDays(habit, addDays(today, -1))) {
      const row = rows[weekdayOf(date)];
      row.due += 1;
      if (isComplete(habit, byDate[date])) row.done += 1;
    }
  }

  for (const row of rows) {
    row.rate = rate(row.done, row.due);
    row.enough = row.due >= MIN_SAMPLE;
  }
  return rows;
}

/**
 * Completion over the last `window` days against the `window` before it.
 * @returns {{recent:number, previous:number, delta:number, direction:'up'|'down'|'level', enough:boolean}}
 */
export function momentum(habits, completions, today = habitToday(), window = 7) {
  const windowRate = (endOffset) => {
    let due = 0;
    let done = 0;
    for (const habit of (habits || []).filter(Boolean)) {
      const byDate = completions?.[habit.id] || {};
      const to = addDays(today, -endOffset - 1);
      const from = addDays(to, -(window - 1));
      for (const date of datesBetween(from, to)) {
        if (date < habit.startDate || !isScheduledOn(habit, date)) continue;
        due += 1;
        if (isComplete(habit, byDate[date])) done += 1;
      }
    }
    return { due, done };
  };

  const a = windowRate(0);
  const b = windowRate(window);
  const recent = rate(a.done, a.due);
  const previous = rate(b.done, b.due);
  const delta = recent - previous;

  return {
    recent,
    previous,
    delta,
    direction: Math.abs(delta) < 0.05 ? 'level' : (delta > 0 ? 'up' : 'down'),
    // Both halves need real scheduled days, or the comparison is noise.
    enough: a.due >= MIN_SAMPLE && b.due >= MIN_SAMPLE,
  };
}

/** Per-habit standing over the whole record. */
export function habitStandings(habits, completions, today = habitToday()) {
  return (habits || []).filter(Boolean).map((habit) => {
    const byDate = completions?.[habit.id] || {};
    const due = getScheduledDays(habit, addDays(today, -1));
    const done = due.filter((d) => isComplete(habit, byDate[d])).length;
    return {
      habit,
      due: due.length,
      done,
      rate: rate(done, due.length),
      enough: due.length >= MIN_SAMPLE,
    };
  }).sort((a, b) => b.rate - a.rate);
}

/**
 * Observations the record actually supports. Each carries its sample so the
 * UI can show what it is based on, and nothing under-evidenced is returned.
 * @returns {Array<{id:string, text:string, sample:number, tone:'good'|'soft'|'plain'}>}
 */
export function findPatterns(habits, completions, today = habitToday(), words = REPORT_WORDS) {
  const out = [];
  const active = (habits || []).filter(Boolean);
  if (!active.length) return out;

  const days = weekdayBreakdown(active, completions, today).filter((d) => d.enough);
  if (days.length >= 3) {
    const best = days.reduce((m, d) => (d.rate > m.rate ? d : m));
    const worst = days.reduce((m, d) => (d.rate < m.rate ? d : m));
    if (best.rate - worst.rate >= NOTABLE_GAP) {
      out.push({
        id: 'best-day',
        text: words.bestDay(best.name.toUpperCase(), pct(best.rate)),
        sample: best.due,
        tone: 'good',
      });
      out.push({
        id: 'worst-day',
        text: words.worstDay(worst.name.toUpperCase(), pct(worst.rate)),
        sample: worst.due,
        tone: 'soft',
      });
    }
  }

  // Weekend versus weekday, when both have been lived enough to compare.
  const all = weekdayBreakdown(active, completions, today);
  const wk = all.filter((d) => d.weekday >= 1 && d.weekday <= 5);
  const we = all.filter((d) => d.weekday === 0 || d.weekday === 6);
  const wkDue = wk.reduce((s, d) => s + d.due, 0);
  const weDue = we.reduce((s, d) => s + d.due, 0);
  if (wkDue >= MIN_SAMPLE * 2 && weDue >= MIN_SAMPLE) {
    const wkRate = rate(wk.reduce((s, d) => s + d.done, 0), wkDue);
    const weRate = rate(we.reduce((s, d) => s + d.done, 0), weDue);
    if (Math.abs(wkRate - weRate) >= NOTABLE_GAP) {
      out.push({
        id: 'weekend',
        text: weRate > wkRate
          ? words.weekendBetter(pct(weRate), pct(wkRate))
          : words.weekBetter(pct(wkRate), pct(weRate)),
        sample: wkDue + weDue,
        tone: 'plain',
      });
    }
  }

  const m = momentum(active, completions, today);
  if (m.enough && m.direction !== 'level') {
    out.push({
      id: 'momentum',
      text: m.direction === 'up'
        ? words.gaining(pct(m.recent), pct(m.previous))
        : words.harder(pct(m.recent), pct(m.previous)),
      sample: 14,
      tone: m.direction === 'up' ? 'good' : 'soft',
    });
  }

  const standings = habitStandings(active, completions, today).filter((s) => s.enough);
  if (standings.length >= 2) {
    const top = standings[0];
    const low = standings[standings.length - 1];
    if (top.rate - low.rate >= NOTABLE_GAP) {
      out.push({
        id: 'steadiest',
        text: words.steadiest(top.habit.name, pct(top.rate)),
        sample: top.due,
        tone: 'good',
      });
      out.push({
        id: 'hardest',
        text: words.hardest(low.habit.name),
        sample: low.due,
        tone: 'soft',
      });
    }
  }

  return out;
}

/** The seven days ending on `end` (inclusive). */
export function weekRange(end) {
  return { from: addDays(end, -6), to: end };
}

/**
 * A week in summary: what was kept, what it earned, and how it compares
 * with the week before.
 */
export function weeklyReport(habits, completions, end = habitToday()) {
  const active = (habits || []).filter(Boolean);
  const { from, to } = weekRange(end);
  const report = {
    from, to,
    due: 0, done: 0, rate: 0,
    perfectDays: 0, xp: 0,
    byHabit: [], best: null, hardest: null,
    previousRate: null, delta: null,
    enough: false,
  };
  if (!active.length) return report;

  for (const habit of active) {
    const byDate = completions?.[habit.id] || {};
    let due = 0;
    let done = 0;
    for (const date of datesBetween(from, to)) {
      if (date < habit.startDate || date > end || !isScheduledOn(habit, date)) continue;
      due += 1;
      if (isComplete(habit, byDate[date])) done += 1;
    }
    report.due += due;
    report.done += done;
    if (due > 0) report.byHabit.push({ habit, due, done, rate: rate(done, due) });
  }

  for (const date of datesBetween(from, to)) {
    if (date > end) break;
    if (classifyDay(active, completions, date) === DAY.PERFECT) report.perfectDays += 1;
  }

  const byDate = computeXpBreakdown(active, completions, end).byDate;
  report.xp = Object.entries(byDate)
    .filter(([date]) => date >= from && date <= to)
    .reduce((sum, [, xp]) => sum + xp, 0);

  report.rate = rate(report.done, report.due);
  report.byHabit.sort((a, b) => b.rate - a.rate);
  if (report.byHabit.length) {
    report.best = report.byHabit[0];
    report.hardest = report.byHabit[report.byHabit.length - 1];
  }

  // Compare with the week before, but only if it was actually tracked.
  const prevEnd = addDays(from, -1);
  const start = earliestStart(active);
  if (start && start <= addDays(prevEnd, -6)) {
    const prev = weeklyReport(active, completions, prevEnd);
    if (prev.due >= MIN_SAMPLE) {
      report.previousRate = prev.rate;
      report.delta = report.rate - prev.rate;
    }
  }

  report.enough = report.due > 0;
  return report;
}

/** A single line for the top of the report. Never scolding. */
export function reportVerdict(report, words = REPORT_WORDS) {
  if (!report.enough) return words.notWritten;
  const p = pct(report.rate);
  if (p === 100) return words.flawless;
  if (p >= 80) return words.strong;
  if (p >= 50) return words.held;
  if (p > 0) return words.hard;
  return words.quiet;
}

/** How many whole weeks of record exist — the report needs at least one. */
export function weeksTracked(habits, today = habitToday()) {
  const start = earliestStart((habits || []).filter(Boolean));
  if (!start) return 0;
  return Math.floor((diffDays(today, start) + 1) / 7);
}
