import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { getDayDetail, dayNumber } from './chronicle';

const MON = '2026-09-07';
const mk = (over) => createHabit({ startDate: MON, ...over });

const read = mk({ id: 'read', name: 'READ', difficulty: 'normal' });
const water = mk({ id: 'water', name: 'WATER', type: 'count', target: 8, difficulty: 'easy' });
const gym = mk({ id: 'gym', name: 'GYM', schedule: { frequency: 'weekly', weekdays: [3] } });  // Wed only

describe('day detail', () => {
  it('sorts habits into completed, missed and not due', () => {
    const completions = { read: { [MON]: { completed: true } }, water: {}, gym: {} };
    const d = getDayDetail([read, water, gym], completions, MON, '2026-09-10');
    expect(d.completed.map((e) => e.habit.id)).toEqual(['read']);
    expect(d.missed.map((e) => e.habit.id)).toEqual(['water']);
    expect(d.notScheduled.map((e) => e.habit.id)).toEqual(['gym']);   // Monday
  });

  it('totals the XP that day was worth', () => {
    const completions = { read: { [MON]: { completed: true } }, water: { [MON]: { value: 8 } }, gym: {} };
    const d = getDayDetail([read, water, gym], completions, MON, '2026-09-10');
    // read 20 + water 10 + perfect-day 50 (gym was not due)
    expect(d.perfect).toBe(true);
    expect(d.xp).toBe(80);
  });

  it('calls an unfinished day outstanding rather than missed', () => {
    const d = getDayDetail([read], { read: {} }, '2026-09-10', '2026-09-10');
    expect(d.missed).toHaveLength(0);
    expect(d.pending.map((e) => e.habit.id)).toEqual(['read']);
  });

  it('shows partial progress without calling it done', () => {
    const d = getDayDetail([water], { water: { [MON]: { value: 3 } } }, MON, '2026-09-10');
    expect(d.completed).toHaveLength(0);
    expect(d.missed[0].progress.text).toBe('3 / 8');
    expect(d.xp).toBe(0);
  });

  it('ignores habits that had not started yet', () => {
    const later = mk({ id: 'later', startDate: '2026-10-01' });
    const d = getDayDetail([read, later], { read: {}, later: {} }, MON, '2026-09-10');
    const ids = [...d.completed, ...d.missed, ...d.pending, ...d.notScheduled].map((e) => e.habit.id);
    expect(ids).not.toContain('later');
  });

  it('marks a future date as such', () => {
    expect(getDayDetail([read], { read: {} }, '2099-01-01', MON).isFuture).toBe(true);
  });

  it('reads an empty day without throwing', () => {
    const d = getDayDetail([], {}, MON, MON);
    expect(d.xp).toBe(0);
    expect(d.perfect).toBe(false);
  });

  it('never mutates what it reads', () => {
    const completions = { read: { [MON]: { completed: true } } };
    const snapshot = JSON.stringify(completions);
    getDayDetail([read], completions, MON, '2026-09-10');
    expect(JSON.stringify(completions)).toBe(snapshot);
  });
});

describe('day numbering', () => {
  it('counts the first tracked day as day 1', () => {
    expect(dayNumber([read], MON)).toBe(1);
    expect(dayNumber([read], '2026-09-08')).toBe(2);
  });

  it('counts across a month boundary', () => {
    expect(dayNumber([mk({ startDate: '2026-08-30' })], '2026-09-02')).toBe(4);
  });

  it('returns null before tracking began', () => {
    expect(dayNumber([read], '2026-09-01')).toBeNull();
    expect(dayNumber([], MON)).toBeNull();
  });
});
