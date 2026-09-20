import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { getStreakHistory, getPreviousStreaks, reasonLabel, BREAK_REASONS } from './history';

const START = '2026-09-01';
const view = (completed, over) => ({
  ...createHabit({ startDate: START, ...over }),
  completed: [...completed].sort(),
});

describe('streak history', () => {
  it('lists every run, newest first', () => {
    const h = view(['2026-09-01', '2026-09-02', '2026-09-05', '2026-09-06', '2026-09-07']);
    const runs = getStreakHistory(h, '2026-09-07');
    expect(runs.map((r) => r.days)).toEqual([3, 2]);
    expect(runs[0].start).toBe('2026-09-05');
    expect(runs[0].end).toBe('2026-09-07');
  });

  it('marks the run that is still going', () => {
    const h = view(['2026-09-01', '2026-09-05', '2026-09-06']);
    const runs = getStreakHistory(h, '2026-09-06');
    expect(runs[0].live).toBe(true);
    expect(runs[1].live).toBe(false);
  });

  it('dates the break as the day after the run ended', () => {
    const h = view(['2026-09-01', '2026-09-02', '2026-09-05']);
    const [, older] = getStreakHistory(h, '2026-09-05');
    expect(older.end).toBe('2026-09-02');
    expect(older.brokenOn).toBe('2026-09-03');
  });

  it('gives a live run no break date', () => {
    const h = view(['2026-09-04', '2026-09-05']);
    expect(getStreakHistory(h, '2026-09-05')[0].brokenOn).toBeNull();
  });

  it('attaches a reason recorded against the run', () => {
    const h = view(['2026-09-01', '2026-09-02', '2026-09-05'], {
      breakReasons: { '2026-09-02': 'sick' },
    });
    const [, older] = getStreakHistory(h, '2026-09-05');
    expect(older.reason).toBe('sick');
  });

  it('never attaches a reason to a live run', () => {
    const h = view(['2026-09-04', '2026-09-05'], { breakReasons: { '2026-09-05': 'busy' } });
    expect(getStreakHistory(h, '2026-09-05')[0].reason).toBeNull();
  });

  it('skips rest days rather than breaking on them', () => {
    // Weekdays only; the weekend gap must not split the run.
    const h = view(
      ['2026-09-03', '2026-09-04', '2026-09-07'],           // Thu, Fri, Mon
      { schedule: { frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] } },
    );
    const runs = getStreakHistory(h, '2026-09-07');
    expect(runs).toHaveLength(1);
    expect(runs[0].days).toBe(3);
  });

  it('returns nothing for a habit with no marks', () => {
    expect(getStreakHistory(view([]), '2026-09-07')).toEqual([]);
  });

  it('returns nothing for no habit at all', () => {
    expect(getStreakHistory(null, '2026-09-07')).toEqual([]);
  });

  it('leaves the live run out of the previous list', () => {
    const h = view(['2026-09-01', '2026-09-05', '2026-09-06']);
    const prev = getPreviousStreaks(h, '2026-09-06');
    expect(prev).toHaveLength(1);
    expect(prev[0].end).toBe('2026-09-01');
  });
});

describe('break reasons', () => {
  it('names a known reason', () => {
    expect(reasonLabel('travel')).toBe('TRAVELLING');
  });

  it('returns nothing for an unknown or absent reason', () => {
    expect(reasonLabel('zzz')).toBeNull();
    expect(reasonLabel(null)).toBeNull();
  });

  it('offers a way to say something the list does not cover', () => {
    expect(BREAK_REASONS.map((r) => r.id)).toContain('other');
  });
});
