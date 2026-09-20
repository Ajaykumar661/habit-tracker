import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { buildAchievementContext, evaluateAchievements, CATALOGUE } from './achievements';

const START = '2026-09-01';
const mk = (over) => createHabit({ startDate: START, ...over });
const marks = (dates, extra) =>
  Object.fromEntries(dates.map((d) => [d, { completed: true, ...extra }]));

const read = mk({ id: 'read', name: 'READ' });

describe('achievement context', () => {
  it('counts every completion across habits', () => {
    const gym = mk({ id: 'gym' });
    const ctx = buildAchievementContext(
      [read, gym],
      { read: marks(['2026-09-01', '2026-09-02']), gym: marks(['2026-09-01']) },
      '2026-09-02',
    );
    expect(ctx.totalCompletions).toBe(3);
  });

  it('ignores partial progress', () => {
    const water = mk({ id: 'water', type: 'count', target: 8 });
    const ctx = buildAchievementContext(
      [water],
      { water: { '2026-09-01': { value: 3 }, '2026-09-02': { value: 8 } } },
      '2026-09-02',
    );
    expect(ctx.totalCompletions).toBe(1);
  });

  it('takes the best streak any habit has ever held', () => {
    const gym = mk({ id: 'gym' });
    const ctx = buildAchievementContext(
      [read, gym],
      {
        read: marks(['2026-09-01', '2026-09-02']),
        gym: marks(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04']),
      },
      '2026-09-04',
    );
    expect(ctx.bestStreak).toBe(4);
  });

  it('sums time only from timed habits', () => {
    const run = mk({ id: 'run', type: 'duration', target: 1800 });
    const ctx = buildAchievementContext(
      [read, run],
      { read: marks(['2026-09-01']), run: { '2026-09-01': { value: 1800 } } },
      '2026-09-01',
    );
    expect(ctx.durationSeconds).toBe(1800);
  });

  it('counts late and early finishes by the clock', () => {
    const ctx = buildAchievementContext(
      [read],
      {
        read: {
          '2026-09-01': { completed: true, completedAt: '2026-09-01T23:30:00' },
          '2026-09-02': { completed: true, completedAt: '2026-09-02T07:15:00' },
          '2026-09-03': { completed: true, completedAt: '2026-09-03T14:00:00' },
        },
      },
      '2026-09-03',
    );
    expect(ctx.lateCompletions).toBe(1);
    expect(ctx.earlyCompletions).toBe(1);
  });

  it('does not guess a time for migrated records that have none', () => {
    const ctx = buildAchievementContext([read], { read: marks(['2026-09-01']) }, '2026-09-01');
    expect(ctx.lateCompletions).toBe(0);
    expect(ctx.earlyCompletions).toBe(0);
  });

  it('counts a run of perfect days', () => {
    const gym = mk({ id: 'gym' });
    const days = ['2026-09-01', '2026-09-02', '2026-09-03'];
    const ctx = buildAchievementContext(
      [read, gym],
      { read: marks(days), gym: marks(days) },
      '2026-09-03',
    );
    expect(ctx.bestPerfectRun).toBe(3);
  });

  it('breaks the perfect run when one habit is missed', () => {
    const gym = mk({ id: 'gym' });
    const ctx = buildAchievementContext(
      [read, gym],
      {
        read: marks(['2026-09-01', '2026-09-02', '2026-09-03']),
        gym: marks(['2026-09-01', '2026-09-03']),
      },
      '2026-09-03',
    );
    expect(ctx.bestPerfectRun).toBe(1);
  });

  it('recognises a return after a long absence', () => {
    // one day, then a four-day gap, then three days back
    const ctx = buildAchievementContext(
      [read],
      { read: marks(['2026-09-01', '2026-09-06', '2026-09-07', '2026-09-08']) },
      '2026-09-08',
    );
    expect(ctx.longestComeback).toBe(3);
  });

  it('does not call an ordinary run a comeback', () => {
    const ctx = buildAchievementContext(
      [read],
      { read: marks(['2026-09-01', '2026-09-02', '2026-09-03']) },
      '2026-09-03',
    );
    expect(ctx.longestComeback).toBe(0);
  });

  it('reads an empty record without throwing', () => {
    const ctx = buildAchievementContext([], {}, '2026-09-01');
    expect(ctx.totalCompletions).toBe(0);
    expect(ctx.bestStreak).toBe(0);
  });

  it('survives a habit that has not started yet', () => {
    const later = mk({ id: 'later', startDate: '2099-01-01' });
    expect(() => buildAchievementContext([later], { later: {} }, '2026-09-01')).not.toThrow();
  });

  it('never mutates what it reads', () => {
    const completions = { read: marks(['2026-09-01']) };
    const snapshot = JSON.stringify(completions);
    buildAchievementContext([read], completions, '2026-09-02');
    expect(JSON.stringify(completions)).toBe(snapshot);
  });
});

describe('scoring the catalogue', () => {
  const evalWith = (habits, completions, today) => {
    const list = evaluateAchievements(habits, completions, today);
    return Object.fromEntries(list.map((a) => [a.id, a]));
  };

  it('unlocks the first completion', () => {
    const by = evalWith([read], { read: marks(['2026-09-01']) }, '2026-09-01');
    expect(by['first-blood'].unlocked).toBe(true);
  });

  it('leaves everything locked on an empty record', () => {
    const list = evaluateAchievements([], {}, '2026-09-01');
    expect(list.every((a) => !a.unlocked)).toBe(true);
  });

  it('reports partial progress toward a target', () => {
    const by = evalWith([read], { read: marks(['2026-09-01', '2026-09-02']) }, '2026-09-02');
    expect(by.century.current).toBe(2);
    expect(by.century.pct).toBe(2);
    expect(by.century.progressText).toBe('2 / 100');
  });

  it('formats hours for the timed achievement', () => {
    const run = mk({ id: 'run', type: 'duration', target: 3600 });
    const by = evalWith([run], { run: { '2026-09-01': { value: 7200 } } }, '2026-09-01');
    expect(by['the-scholar'].progressText).toBe('2H / 50H');
  });

  it('never reports more than full progress', () => {
    const by = evalWith([read], { read: marks(['2026-09-01']) }, '2026-09-01');
    expect(by['first-blood'].pct).toBe(100);
  });

  it('puts unlocked achievements first', () => {
    const list = evaluateAchievements([read], { read: marks(['2026-09-01']) }, '2026-09-01');
    const firstLocked = list.findIndex((a) => !a.unlocked);
    expect(list.slice(0, firstLocked).every((a) => a.unlocked)).toBe(true);
  });

  it('orders the locked ones by how close they are', () => {
    const list = evaluateAchievements([read], { read: marks(['2026-09-01']) }, '2026-09-01')
      .filter((a) => !a.unlocked);
    const pcts = list.map((a) => a.pct);
    expect([...pcts].sort((x, y) => y - x)).toEqual(pcts);
  });

  it('gives every entry a unique id', () => {
    const ids = CATALOGUE.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every entry a title, description and positive target', () => {
    for (const a of CATALOGUE) {
      expect(a.title, a.id).toBeTruthy();
      expect(a.desc, a.id).toBeTruthy();
      expect(a.target, a.id).toBeGreaterThan(0);
    }
  });

  it('keeps the original streak milestones in the catalogue', () => {
    const ids = CATALOGUE.map((a) => a.id);
    expect(ids).toContain('streak-7');
    expect(ids).toContain('streak-30');
  });
});
