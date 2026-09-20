import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { getRecovery, recoveryMessage, RECOVERY_RULES } from './recovery';

const START = '2026-08-01';
const view = (completed, over) => ({
  ...createHabit({ startDate: START, ...over }),
  completed: [...completed].sort(),
});
const days = (from, to) => {
  const out = [];
  const d = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const p = (n) => String(n).padStart(2, '0');
  while (d <= end) {
    out.push(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
};

describe('when a rally starts', () => {
  it('starts after a run of real length lapses', () => {
    // five days, a miss, then two days back
    const h = view([...days('2026-09-10', '2026-09-14'), '2026-09-16', '2026-09-17']);
    const r = getRecovery(h, '2026-09-17');
    expect(r.active).toBe(true);
    expect(r.lostRun).toBe(5);
    expect(r.daysBack).toBe(2);
  });

  it('stays out of the way while a streak is unbroken', () => {
    const h = view(days('2026-09-10', '2026-09-17'));
    expect(getRecovery(h, '2026-09-17').active).toBe(false);
  });

  it('does not stage a comeback from a run too short to mourn', () => {
    // two days, a miss, then back — not worth a recovery arc
    const h = view(['2026-09-12', '2026-09-13', '2026-09-15']);
    const r = getRecovery(h, '2026-09-15');
    expect(r.lostRun).toBeLessThan(RECOVERY_RULES.minLostRun);
    expect(r.active).toBe(false);
  });

  it('lets an old break become history rather than nagging forever', () => {
    const h = view([...days('2026-08-02', '2026-08-06'), ...days('2026-08-08', '2026-09-17')]);
    expect(getRecovery(h, '2026-09-17').active).toBe(false);
  });

  it('says nothing at all for a habit with no misses', () => {
    const h = view(days(START, '2026-09-17'));
    expect(getRecovery(h, '2026-09-17').active).toBe(false);
  });

  it('handles no habit at all', () => {
    expect(getRecovery(null, '2026-09-17').active).toBe(false);
  });
});

describe('rally progress', () => {
  const rallying = (backDays) => view([
    ...days('2026-09-10', '2026-09-14'),                 // the run that was lost
    ...(backDays ? days('2026-09-16', `2026-09-${15 + backDays}`) : []),
  ]);

  it('counts nothing back on the day after the break', () => {
    const r = getRecovery(rallying(0), '2026-09-16');
    expect(r.daysBack).toBe(0);
    expect(r.remaining).toBe(3);
    expect(r.pct).toBe(0);
  });

  it('counts each day back', () => {
    expect(getRecovery(rallying(1), '2026-09-16').daysBack).toBe(1);
    expect(getRecovery(rallying(2), '2026-09-17').daysBack).toBe(2);
  });

  it('reports progress toward the goal', () => {
    const r = getRecovery(rallying(2), '2026-09-17');
    expect(r.goal).toBe(3);
    expect(r.remaining).toBe(1);
    expect(r.pct).toBe(67);
  });

  it('is won once the goal is reached', () => {
    const r = getRecovery(rallying(3), '2026-09-18');
    expect(r.complete).toBe(true);
    expect(r.pct).toBe(100);
    expect(r.remaining).toBe(0);
  });

  it('never reports more than a won rally', () => {
    const r = getRecovery(rallying(5), '2026-09-20');
    expect(r.pct).toBe(100);
    expect(r.remaining).toBe(0);
  });

  it('knows whether the habit is due today', () => {
    const weekdays = { frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] };
    const h = view([...days('2026-09-07', '2026-09-11')], { schedule: weekdays });
    // 2026-09-19 is a Saturday, so nothing is due
    expect(getRecovery(h, '2026-09-19').dueToday).toBe(false);
  });

  it('skips rest days when counting the way back', () => {
    const weekdays = { schedule: { frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] } };
    // Mon-Fri run, miss the next Monday, back Tue/Wed/Thu
    const h = view([
      ...days('2026-09-07', '2026-09-11'),
      '2026-09-15', '2026-09-16', '2026-09-17',
    ], weekdays);
    const r = getRecovery(h, '2026-09-17');
    expect(r.lastMiss).toBe('2026-09-14');
    expect(r.daysBack).toBe(3);
    expect(r.complete).toBe(true);
  });

  it('never mutates the habit it reads', () => {
    const h = rallying(2);
    const snapshot = JSON.stringify(h);
    getRecovery(h, '2026-09-17');
    expect(JSON.stringify(h)).toBe(snapshot);
  });
});

describe('what the rally says', () => {
  it('says nothing when there is no rally', () => {
    expect(recoveryMessage({ active: false })).toBeNull();
  });

  it('invites the first mark when nothing is back yet', () => {
    expect(recoveryMessage({ active: true, daysBack: 0, remaining: 3, dueToday: true }))
      .toContain('BEGINS THE RALLY');
  });

  it('waits for the next due day rather than asking on a rest day', () => {
    expect(recoveryMessage({ active: true, daysBack: 0, remaining: 3, dueToday: false }))
      .toContain('NEXT DUE DAY');
  });

  it('counts down the days left', () => {
    expect(recoveryMessage({ active: true, daysBack: 1, remaining: 2 })).toContain('2 MORE DAYS');
    expect(recoveryMessage({ active: true, daysBack: 2, remaining: 1 })).toContain('ONE MORE DAY');
  });

  it('celebrates a won rally', () => {
    expect(recoveryMessage({ active: true, complete: true })).toContain('WON');
  });

  it('never reproaches the reader', () => {
    const lines = [
      recoveryMessage({ active: true, daysBack: 0, remaining: 3, dueToday: true }),
      recoveryMessage({ active: true, daysBack: 1, remaining: 2 }),
      recoveryMessage({ active: true, complete: true }),
    ];
    for (const line of lines) {
      expect(line).not.toMatch(/FAIL|BROKE|LOST|LAZY|SHOULD/);
    }
  });
});
