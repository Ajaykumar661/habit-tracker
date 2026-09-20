import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import {
  weekdayBreakdown, momentum, habitStandings, findPatterns,
  weeklyReport, reportVerdict, weeksTracked, MIN_SAMPLE,
} from './analytics';
import { addDays } from '../lib/dates';

// 2026-09-07 is a Monday; 2026-09-21 is a Monday four weeks on.
const MON = '2026-09-07';
const TODAY = '2026-09-21';
const mk = (over) => createHabit({ startDate: MON, ...over });
const marks = (dates) => Object.fromEntries(dates.map((d) => [d, { date: d, completed: true }]));
const every = (from, to) => {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
};

const read = mk({ id: 'read', name: 'READING' });

describe('weekday breakdown', () => {
  it('counts each weekday separately', () => {
    const rows = weekdayBreakdown([read], { read: marks(every(MON, '2026-09-20')) }, TODAY);
    expect(rows).toHaveLength(7);
    expect(rows[1].name).toBe('MON');
    expect(rows.reduce((s, r) => s + r.due, 0)).toBe(14);   // Sep 7..20
  });

  it('leaves today out, since it is still in play', () => {
    const rows = weekdayBreakdown([read], { read: {} }, TODAY);
    // Sep 21 is a Monday and must not be counted as missed.
    expect(rows[1].due).toBe(2);   // Sep 7 and Sep 14 only
  });

  it('scores a weekday by what was kept on it', () => {
    // every Monday kept, no other day
    const mondays = ['2026-09-07', '2026-09-14'];
    const rows = weekdayBreakdown([read], { read: marks(mondays) }, TODAY);
    expect(rows[1].rate).toBe(1);
    expect(rows[2].rate).toBe(0);
  });

  it('flags a weekday with too little history as not enough', () => {
    const rows = weekdayBreakdown([read], { read: {} }, '2026-09-10');
    expect(rows.every((r) => !r.enough)).toBe(true);
  });

  it('ignores days a habit was not scheduled on', () => {
    const wed = mk({ id: 'wed', schedule: { frequency: 'weekly', weekdays: [3] } });
    const rows = weekdayBreakdown([wed], { wed: {} }, TODAY);
    expect(rows.filter((r) => r.due > 0).map((r) => r.name)).toEqual(['WED']);
  });

  it('reads an empty record without throwing', () => {
    expect(weekdayBreakdown([], {}, TODAY).every((r) => r.due === 0)).toBe(true);
  });
});

describe('momentum', () => {
  it('sees an improving fortnight', () => {
    // nothing in the older week, everything in the recent one
    const recent = every('2026-09-14', '2026-09-20');
    const m = momentum([read], { read: marks(recent) }, TODAY);
    expect(m.recent).toBe(1);
    expect(m.previous).toBe(0);
    expect(m.direction).toBe('up');
    expect(m.enough).toBe(true);
  });

  it('sees a declining fortnight', () => {
    const older = every('2026-09-07', '2026-09-13');
    const m = momentum([read], { read: marks(older) }, TODAY);
    expect(m.direction).toBe('down');
  });

  it('calls two equal weeks level', () => {
    const m = momentum([read], { read: marks(every(MON, '2026-09-20')) }, TODAY);
    expect(m.direction).toBe('level');
  });

  it('refuses to compare when there is not enough of either week', () => {
    const fresh = mk({ id: 'fresh', startDate: '2026-09-19' });
    expect(momentum([fresh], { fresh: {} }, TODAY).enough).toBe(false);
  });
});

describe('habit standings', () => {
  it('ranks habits by how well they are kept', () => {
    const gym = mk({ id: 'gym', name: 'GYM' });
    const s = habitStandings(
      [read, gym],
      { read: marks(every(MON, '2026-09-20')), gym: marks(['2026-09-07']) },
      TODAY,
    );
    expect(s.map((x) => x.habit.id)).toEqual(['read', 'gym']);
    expect(s[0].rate).toBe(1);
  });

  it('marks a habit with too little history as not enough', () => {
    const fresh = mk({ id: 'fresh', startDate: '2026-09-20' });
    expect(habitStandings([fresh], { fresh: {} }, TODAY)[0].enough).toBe(false);
  });
});

describe('pattern discovery', () => {
  it('says nothing at all about an empty record', () => {
    expect(findPatterns([], {}, TODAY)).toEqual([]);
  });

  it('stays quiet until there is enough evidence', () => {
    const fresh = mk({ id: 'fresh', startDate: '2026-09-19' });
    expect(findPatterns([fresh], { fresh: marks(['2026-09-19']) }, TODAY)).toEqual([]);
  });

  it('names a strongest and a hardest day when they differ enough', () => {
    // Mondays and Tuesdays kept, Wednesdays never — over eight weeks.
    const start = '2026-07-27';   // a Monday
    const h = mk({ id: 'h', startDate: start });
    const days = every(start, '2026-09-20');
    const kept = days.filter((d) => {
      const wd = new Date(`${d}T00:00:00`).getDay();
      return wd !== 3;
    });
    const found = findPatterns([h], { h: marks(kept) }, TODAY);
    const ids = found.map((f) => f.id);
    expect(ids).toContain('best-day');
    expect(ids).toContain('worst-day');
    expect(found.find((f) => f.id === 'worst-day').text).toContain('WED');
  });

  it('carries the sample each observation rests on', () => {
    const start = '2026-07-27';
    const h = mk({ id: 'h', startDate: start });
    const kept = every(start, '2026-09-20').filter((d) => new Date(`${d}T00:00:00`).getDay() !== 3);
    for (const f of findPatterns([h], { h: marks(kept) }, TODAY)) {
      expect(f.sample, f.id).toBeGreaterThanOrEqual(MIN_SAMPLE);
    }
  });

  it('never returns an observation without text or a tone', () => {
    const start = '2026-07-27';
    const h = mk({ id: 'h', startDate: start });
    const kept = every(start, '2026-09-20').filter((d) => new Date(`${d}T00:00:00`).getDay() !== 3);
    for (const f of findPatterns([h], { h: marks(kept) }, TODAY)) {
      expect(f.text, f.id).toBeTruthy();
      expect(['good', 'soft', 'plain']).toContain(f.tone);
    }
  });

  it('notes momentum when the two weeks differ', () => {
    const recent = every('2026-09-14', '2026-09-20');
    const found = findPatterns([read], { read: marks(recent) }, TODAY);
    expect(found.map((f) => f.id)).toContain('momentum');
  });

  it('contrasts two habits when one is clearly steadier', () => {
    const gym = mk({ id: 'gym', name: 'GYM' });
    const found = findPatterns(
      [read, gym],
      { read: marks(every(MON, '2026-09-20')), gym: marks(['2026-09-07']) },
      TODAY,
    );
    const ids = found.map((f) => f.id);
    expect(ids).toContain('steadiest');
    expect(ids).toContain('hardest');
    expect(found.find((f) => f.id === 'steadiest').text).toContain('READING');
  });

  it('never mutates what it reads', () => {
    const completions = { read: marks(every(MON, '2026-09-20')) };
    const snapshot = JSON.stringify(completions);
    findPatterns([read], completions, TODAY);
    expect(JSON.stringify(completions)).toBe(snapshot);
  });
});

describe('weekly report', () => {
  it('covers the seven days ending today', () => {
    const r = weeklyReport([read], { read: {} }, TODAY);
    expect(r.from).toBe('2026-09-15');
    expect(r.to).toBe(TODAY);
  });

  it('counts what was due and what was kept', () => {
    const r = weeklyReport([read], { read: marks(every('2026-09-15', '2026-09-18')) }, TODAY);
    expect(r.due).toBe(7);
    expect(r.done).toBe(4);
    expect(r.rate).toBeCloseTo(4 / 7);
  });

  it('counts perfect days in the week', () => {
    const gym = mk({ id: 'gym', name: 'GYM' });
    const both = every('2026-09-15', '2026-09-17');
    const r = weeklyReport([read, gym], { read: marks(both), gym: marks(both) }, TODAY);
    expect(r.perfectDays).toBe(3);
  });

  it('totals the XP the week earned', () => {
    const r = weeklyReport([read], { read: marks(['2026-09-15', '2026-09-16']) }, TODAY);
    // two normal completions at 20, each a perfect day at 50
    expect(r.xp).toBe(140);
  });

  it('names the best and hardest habit of the week', () => {
    const gym = mk({ id: 'gym', name: 'GYM' });
    const r = weeklyReport(
      [read, gym],
      { read: marks(every('2026-09-15', TODAY)), gym: marks(['2026-09-15']) },
      TODAY,
    );
    expect(r.best.habit.id).toBe('read');
    expect(r.hardest.habit.id).toBe('gym');
  });

  it('compares with the week before once there is one', () => {
    const r = weeklyReport(
      [read],
      { read: marks(every('2026-09-15', TODAY)) },   // this week only
      TODAY,
    );
    expect(r.previousRate).toBe(0);
    expect(r.delta).toBe(1);
  });

  it('does not invent a comparison before the record goes back that far', () => {
    const fresh = mk({ id: 'fresh', startDate: '2026-09-18' });
    const r = weeklyReport([fresh], { fresh: {} }, TODAY);
    expect(r.previousRate).toBeNull();
    expect(r.delta).toBeNull();
  });

  it('reads an empty record without throwing', () => {
    const r = weeklyReport([], {}, TODAY);
    expect(r.enough).toBe(false);
    expect(r.xp).toBe(0);
  });
});

describe('the weekly verdict', () => {
  const verdictFor = (rate, enough = true) => reportVerdict({ rate, enough });

  it('celebrates a flawless week', () => {
    expect(verdictFor(1)).toContain('FLAWLESS');
  });

  it('is encouraging about a hard week rather than critical', () => {
    const line = verdictFor(0.2);
    expect(line).toContain('STILL COUNTS');
    expect(line).not.toMatch(/FAIL|BAD|POOR|LAZY/);
  });

  it('stays kind about a week with nothing in it', () => {
    const line = verdictFor(0);
    expect(line).toContain('PATIENT');
  });

  it('says so when the week has not been lived yet', () => {
    expect(verdictFor(0, false)).toBe('THE WEEK IS NOT YET WRITTEN.');
  });
});

describe('weeks tracked', () => {
  it('counts whole weeks since tracking began', () => {
    expect(weeksTracked([read], TODAY)).toBe(2);       // Sep 7..21 is 15 days
    expect(weeksTracked([read], '2026-09-12')).toBe(0);
  });

  it('counts nothing when there are no habits', () => {
    expect(weeksTracked([], TODAY)).toBe(0);
  });
});
