import { describe, it, expect } from 'vitest';
import { bestStreakOf, earnedMilestones, nextMilestone, catLookFor, seasonOf } from './room';
import { createHabit } from './schema';
import { addDays } from '../lib/dates';

const TODAY = '2026-09-21';
const days = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i));
const routine = (id, completed) => ({ ...createHabit({ id, name: id, startDate: '2026-01-01' }), completed });

const MILESTONES = [
  { id: 'candle', day: 7 }, { id: 'goblet', day: 30 }, { id: 'crown', day: 100 },
];

describe('the room is earned by the best run ever', () => {
  it('takes the longest run across every routine', () => {
    const a = routine('a', days('2026-09-01', 5));
    const b = routine('b', days('2026-06-01', 40));
    expect(bestStreakOf([a, b], TODAY)).toBe(40);
  });

  it('keeps a broken run’s best: what was built stays', () => {
    // 12 days in March, nothing since
    expect(bestStreakOf([routine('a', days('2026-03-01', 12))], TODAY)).toBe(12);
  });

  it('is zero with nothing logged', () => {
    expect(bestStreakOf([routine('a', [])], TODAY)).toBe(0);
    expect(bestStreakOf([], TODAY)).toBe(0);
  });
});

describe('milestones', () => {
  it('lists what has been earned, oldest first', () => {
    expect(earnedMilestones(MILESTONES, 45).map((m) => m.id)).toEqual(['candle', 'goblet']);
    expect(earnedMilestones(MILESTONES, 6)).toEqual([]);
  });

  it('counts the day itself as earned', () => {
    expect(earnedMilestones(MILESTONES, 7).map((m) => m.id)).toEqual(['candle']);
  });

  it('names the next one to earn, and none once complete', () => {
    expect(nextMilestone(MILESTONES, 8).id).toBe('goblet');
    expect(nextMilestone(MILESTONES, 500)).toBeNull();
  });
});

describe('the cat', () => {
  const cat = { bed: { day: 30 }, crown: { day: 100 } };
  it('sleeps on her ledge, then a bed, then wears her crown', () => {
    expect(catLookFor(cat, 29)).toBeNull();
    expect(catLookFor(cat, 30)).toBe('bed');
    expect(catLookFor(cat, 100)).toBe('crown');
  });

  it('only wears what the theme has', () => {
    expect(catLookFor({ bed: { day: 30 } }, 200)).toBe('bed');
    expect(catLookFor({}, 200)).toBeNull();
  });
});

describe('seasons', () => {
  it('changes by whole month', () => {
    expect(seasonOf('2026-12-01')).toBe('winter');
    expect(seasonOf('2026-02-28')).toBe('winter');
    expect(seasonOf('2026-03-01')).toBe('spring');
    expect(seasonOf('2026-06-15')).toBe('summer');
    expect(seasonOf('2026-09-21')).toBe('autumn');
    expect(seasonOf('2026-11-30')).toBe('autumn');
  });
});
