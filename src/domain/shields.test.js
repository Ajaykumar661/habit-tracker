import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { computeShields, SHIELD_RULES, latestShieldSpend } from './shields';
import { computeStats, calculateCurrentStreak, getMissedDays } from './streaks';
import { perfectDayStats, classifyDay, getPerfectDays, DAY } from './perfectDays';
import { datesBetween, addDays } from '../lib/dates';

const routine = (startDate, completed, over = {}) => ({
  ...createHabit({ name: 'T', startDate, ...over }),
  completed,
});

/** Completed every day from `start` for `n` days. */
const runOf = (start, n) => datesBetween(start, addDays(start, n - 1));

describe('earning shields', () => {
  it('grants nothing before the first milestone', () => {
    const done = runOf('2026-09-01', 6);
    const r = routine('2026-09-01', done);
    expect(computeShields(r, done, '2026-09-06').earned).toBe(0);
  });

  it('grants one at seven days', () => {
    const done = runOf('2026-09-01', 7);
    const r = routine('2026-09-01', done);
    const s = computeShields(r, done, '2026-09-07');
    expect(s.earned).toBe(1);
    expect(s.available).toBe(1);
  });

  it('grants each milestone once, not once per day beyond it', () => {
    const done = runOf('2026-09-01', 20);
    const r = routine('2026-09-01', done);
    expect(computeShields(r, done, addDays('2026-09-01', 19)).earned).toBe(1);
  });

  it('grants a second at thirty and a third at a hundred', () => {
    const done30 = runOf('2026-09-01', 30);
    expect(computeShields(routine('2026-09-01', done30), done30, addDays('2026-09-01', 29)).earned).toBe(2);

    const done100 = runOf('2026-01-01', 100);
    expect(computeShields(routine('2026-01-01', done100), done100, addDays('2026-01-01', 99)).earned).toBe(3);
  });

  it('never holds more than the cap', () => {
    const done = runOf('2026-01-01', 150);
    const s = computeShields(routine('2026-01-01', done), done, addDays('2026-01-01', 149));
    expect(s.available).toBeLessThanOrEqual(SHIELD_RULES.maxHeld);
  });
});

describe('spending shields', () => {
  // Seven days earns a shield; day 8 is skipped; day 9 resumes.
  const done = [...runOf('2026-09-01', 7), '2026-09-09'];
  const r = routine('2026-09-01', done);
  const today = '2026-09-09';

  it('spends one on a missed scheduled day', () => {
    const s = computeShields(r, done, today);
    expect(s.spent).toHaveLength(1);
    expect(s.spent[0].date).toBe('2026-09-08');
    expect(s.spent[0].streakAtTime).toBe(7);
    expect(s.available).toBe(0);
  });

  it('keeps the streak alive across the gap', () => {
    expect(calculateCurrentStreak(r, done, today)).toBe(8);   // 7 + the 9th
  });

  it('does not award a tally for the shielded day', () => {
    const stats = computeStats(r, today);
    expect(stats.currentSegment.dates).not.toContain('2026-09-08');
    expect(stats.currentSegment.dates).toHaveLength(8);
  });

  it('still counts the day as missed — the record is not rewritten', () => {
    expect(getMissedDays(r, done, today)).toContain('2026-09-08');
    expect(computeStats(r, today).missedDays).toBe(1);
    expect(r.completed).not.toContain('2026-09-08');
  });

  it('breaks normally once shields run out', () => {
    // Seven days, then two separate misses. Only the first is covered.
    const d = [...runOf('2026-09-01', 7), '2026-09-09'];
    const rr = routine('2026-09-01', d);
    expect(calculateCurrentStreak(rr, d, '2026-09-11')).toBe(0);   // 09-10 unprotected
    expect(computeShields(rr, d, '2026-09-11').spent).toHaveLength(1);
  });

  it('reports the most recent spend', () => {
    expect(latestShieldSpend(computeShields(r, done, today)).date).toBe('2026-09-08');
    expect(latestShieldSpend({ spent: [] })).toBeNull();
  });

  it('never spends a shield on today merely being unfinished', () => {
    const d = runOf('2026-09-01', 7);
    const rr = routine('2026-09-01', d);
    const s = computeShields(rr, d, '2026-09-08');      // today unmarked
    expect(s.spent).toHaveLength(0);
    expect(s.available).toBe(1);
  });

  it('does not spend on an unscheduled day', () => {
    // Mon/Wed/Fri; the Tuesdays in between are not misses.
    const mwf = { frequency: 'weekly', weekdays: [1, 3, 5] };
    const d = ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-16', '2026-09-18', '2026-09-21'];
    const rr = routine('2026-09-07', d, { schedule: mwf });
    const s = computeShields(rr, d, '2026-09-21');
    expect(s.spent).toHaveLength(0);
    expect(s.earned).toBe(1);                            // seven due days met
  });

  it('is deterministic — the same history always gives the same answer', () => {
    const runs = [1, 2, 3].map(() => JSON.stringify({
      ...computeShields(r, done, today),
      shieldedDates: [...computeShields(r, done, today).shieldedDates],
    }));
    expect(new Set(runs).size).toBe(1);
  });
});

describe('perfect days', () => {
  const a = createHabit({ id: 'a', name: 'A', startDate: '2026-09-01' });
  const b = createHabit({ id: 'b', name: 'B', startDate: '2026-09-01' });
  const on = (dates) => Object.fromEntries(dates.map((d) => [d, { completed: true }]));

  it('needs every due habit done', () => {
    const c = { a: on(['2026-09-01']), b: on(['2026-09-01']) };
    expect(classifyDay([a, b], c, '2026-09-01')).toBe(DAY.PERFECT);
    expect(classifyDay([a, b], { a: on(['2026-09-01']), b: {} }, '2026-09-01')).toBe(DAY.IMPERFECT);
  });

  it('marks a day with nothing due as neither', () => {
    const sunday = createHabit({ id: 's', startDate: '2026-09-01', schedule: { frequency: 'weekly', weekdays: [0] } });
    expect(classifyDay([sunday], { s: {} }, '2026-09-01')).toBe(DAY.NONE_DUE);   // a Tuesday
  });

  it('counts totals, current and longest', () => {
    const c = {
      a: on(['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05']),
      b: on(['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05']),
    };
    const s = perfectDayStats([a, b], c, '2026-09-05');
    expect(s.total).toBe(4);
    expect(s.longest).toBe(2);
    expect(s.current).toBe(2);
    expect(getPerfectDays([a, b], c, '2026-09-05')).toHaveLength(4);
  });

  it('does not let a rest day break the run', () => {
    // Due Mon and Wed only; Tuesday is skipped rather than counted against.
    const mw = { frequency: 'weekly', weekdays: [1, 3] };
    const h = createHabit({ id: 'h', startDate: '2026-09-07', schedule: mw });
    const c = { h: on(['2026-09-07', '2026-09-09']) };
    const s = perfectDayStats([h], c, '2026-09-09');
    expect(s.total).toBe(2);
    expect(s.current).toBe(2);       // Tuesday between them did not reset it
  });

  it('does not break the run just because today is unfinished', () => {
    const c = { a: on(['2026-09-01', '2026-09-02']), b: on(['2026-09-01', '2026-09-02']) };
    expect(perfectDayStats([a, b], c, '2026-09-03').current).toBe(2);
  });

  it('survives having no habits', () => {
    expect(perfectDayStats([], {}, '2026-09-01')).toEqual({ total: 0, current: 0, longest: 0, days: [] });
  });
});

describe('shields surface through computeStats', () => {
  it('are reported alongside the streak', () => {
    const done = runOf('2026-09-01', 7);
    const s = computeStats(routine('2026-09-01', done), '2026-09-07');
    expect(s.shields.available).toBe(1);
    expect(s.shields.earned).toBe(1);
  });

  it('suppress the broken-streak report when the run was saved', () => {
    const done = [...runOf('2026-09-01', 7), '2026-09-09'];
    const s = computeStats(routine('2026-09-01', done), '2026-09-09');
    expect(s.brokenStreak).toBeNull();
    expect(s.currentStreak).toBe(8);
  });

  it('still report a break once shields are gone', () => {
    const done = [...runOf('2026-09-01', 7), '2026-09-09'];
    const s = computeStats(routine('2026-09-01', done), '2026-09-12');
    expect(s.currentStreak).toBe(0);
    expect(s.brokenStreak).toEqual({ days: 8, endedOn: '2026-09-09' });
  });
});
