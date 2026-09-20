import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { isScheduledOn, scheduledDatesBetween, describeSchedule, daysPerWeek } from './schedule';
import {
  computeStats, computeSegments, calculateCurrentStreak, calculateLongestStreak,
  calculateCompletionRate, getMissedDays, getScheduledDays, calculateRecoveryStreak,
  getBrokenStreak, getAchievementDate,
} from './streaks';
import { addDays, diffDays, weekdayOf, habitDateOf, habitToday, datesBetween } from '../lib/dates';

/** A habit plus its completed dates, in the shape the engine consumes. */
const routine = (startDate, completed, schedule = { frequency: 'daily' }) => ({
  ...createHabit({ name: 'T', startDate, schedule }),
  completed,
});

// 2026-09-07 is a Monday, which makes the weekday cases readable.
const MON = '2026-09-07';

describe('date utilities', () => {
  it('adds days across a month boundary', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
  });

  it('adds days across a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });

  it('handles leap years', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');   // 2028 is a leap year
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');   // 2026 is not
    expect(diffDays('2028-03-01', '2028-02-28')).toBe(2);
  });

  it('counts whole days regardless of DST shifts', () => {
    // Spans the usual northern-hemisphere DST changes; a raw ms/86400000
    // would come out as 0.958 or 1.04 on the shifting day.
    expect(diffDays('2026-03-30', '2026-03-29')).toBe(1);
    expect(diffDays('2026-11-02', '2026-11-01')).toBe(1);
    expect(diffDays('2026-04-01', '2026-03-01')).toBe(31);
  });

  it('never derives a date through UTC', () => {
    // 23:30 local must be *today*, even where the UTC date has rolled over.
    const late = new Date(2026, 8, 20, 23, 30, 0);
    expect(habitDateOf(late, 0)).toBe('2026-09-20');
  });

  it('applies the day cutoff to the small hours', () => {
    const at0130 = new Date(2026, 8, 21, 1, 30, 0);
    expect(habitDateOf(at0130, 0)).toBe('2026-09-21');   // no cutoff: new day
    expect(habitDateOf(at0130, 2)).toBe('2026-09-20');   // cutoff 2am: still yesterday
    const at0230 = new Date(2026, 8, 21, 2, 30, 0);
    expect(habitDateOf(at0230, 2)).toBe('2026-09-21');   // past the cutoff
  });

  it('clamps a nonsense cutoff instead of shifting wildly', () => {
    const t = new Date(2026, 8, 21, 12, 0, 0);
    expect(habitDateOf(t, 99)).toBe('2026-09-21');
    expect(habitDateOf(t, -5)).toBe('2026-09-21');
    expect(habitToday(0, t)).toBe('2026-09-21');
  });

  it('lists inclusive ranges', () => {
    expect(datesBetween('2026-09-07', '2026-09-09')).toEqual(['2026-09-07', '2026-09-08', '2026-09-09']);
    expect(datesBetween('2026-09-09', '2026-09-07')).toEqual([]);
  });
});

describe('schedule', () => {
  const weekly = createHabit({ startDate: MON, schedule: { frequency: 'weekly', weekdays: [1, 3, 5] } });

  it('knows Monday from Tuesday', () => {
    expect(weekdayOf(MON)).toBe(1);
    expect(isScheduledOn(weekly, MON)).toBe(true);              // Mon
    expect(isScheduledOn(weekly, addDays(MON, 1))).toBe(false); // Tue
    expect(isScheduledOn(weekly, addDays(MON, 2))).toBe(true);  // Wed
  });

  it('is never scheduled before the habit started', () => {
    expect(isScheduledOn(weekly, addDays(MON, -7))).toBe(false);
  });

  it('is never scheduled after archiving', () => {
    const archived = { ...weekly, archivedAt: new Date(2026, 8, 9).toISOString() };
    expect(isScheduledOn(archived, '2026-09-09')).toBe(true);
    expect(isScheduledOn(archived, '2026-09-14')).toBe(false);
  });

  it('treats an empty weekday list as never due, not always due', () => {
    const none = createHabit({ startDate: MON, schedule: { frequency: 'weekly', weekdays: [] } });
    expect(isScheduledOn(none, MON)).toBe(false);
    expect(getScheduledDays({ ...none, completed: [] }, addDays(MON, 30))).toEqual([]);
  });

  it('daily is scheduled every day', () => {
    const daily = createHabit({ startDate: MON });
    expect(scheduledDatesBetween(daily, MON, addDays(MON, 6))).toHaveLength(7);
    expect(daysPerWeek(daily)).toBe(7);
  });

  it('describes itself readably', () => {
    expect(describeSchedule(createHabit({ schedule: { frequency: 'daily' } }))).toBe('EVERY DAY');
    expect(describeSchedule(weekly)).toBe('MON WED FRI');
    expect(describeSchedule(createHabit({ schedule: { frequency: 'weekly', weekdays: [1, 2, 3, 4, 5] } }))).toBe('WEEKDAYS');
    expect(describeSchedule(createHabit({ schedule: { frequency: 'weekly', weekdays: [0, 6] } }))).toBe('WEEKENDS');
  });
});

describe('daily streaks (unchanged behaviour)', () => {
  it('counts a clean run', () => {
    const r = routine('2026-09-01', ['2026-09-01', '2026-09-02', '2026-09-03']);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-03')).toBe(3);
  });

  it('stays alive while today is merely unmarked', () => {
    const r = routine('2026-09-01', ['2026-09-01', '2026-09-02']);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-03')).toBe(2);
  });

  it('breaks once a whole day is skipped', () => {
    const r = routine('2026-09-01', ['2026-09-01', '2026-09-02']);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-04')).toBe(0);
    expect(getBrokenStreak(r, r.completed, '2026-09-04')).toEqual({ days: 2, endedOn: '2026-09-02' });
  });

  it('remembers the longest run after a break', () => {
    const r = routine('2026-09-01', [
      '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04',   // 4
      '2026-09-06', '2026-09-07',                                // 2
    ]);
    expect(calculateLongestStreak(r, r.completed, '2026-09-07')).toBe(4);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-07')).toBe(2);
  });

  it('counts a run spanning a year boundary', () => {
    const dates = datesBetween('2026-12-29', '2027-01-03');
    const r = routine('2026-12-29', dates);
    expect(calculateCurrentStreak(r, dates, '2027-01-03')).toBe(6);
  });
});

describe('weekly streaks', () => {
  // Mon / Wed / Fri, starting Monday 2026-09-07
  const sched = { frequency: 'weekly', weekdays: [1, 3, 5] };

  it('is not broken by an unscheduled day passing', () => {
    // Mon + Wed done; today is Thursday, which is not due.
    const r = routine(MON, ['2026-09-07', '2026-09-09'], sched);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-10')).toBe(2);
  });

  it('is broken by a missed scheduled day', () => {
    // Mon done, Wed skipped, today Friday.
    const r = routine(MON, ['2026-09-07'], sched);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-11')).toBe(0);
    expect(getMissedDays(r, r.completed, '2026-09-11')).toEqual(['2026-09-09']);
  });

  it('survives today being due but not yet done', () => {
    const r = routine(MON, ['2026-09-07', '2026-09-09'], sched);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-11')).toBe(2);   // Friday, pending
  });

  it('counts only scheduled days, across weeks', () => {
    const r = routine(MON, ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14'], sched);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-14')).toBe(4);
    expect(getScheduledDays(r, '2026-09-14')).toEqual(
      ['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14'],
    );
  });

  it('ignores work done on a day that was not due', () => {
    // Tuesday isn't scheduled; logging it shouldn't extend the streak…
    const r = routine(MON, ['2026-09-07', '2026-09-08'], sched);
    expect(calculateCurrentStreak(r, r.completed, '2026-09-08')).toBe(1);
    // …but it still counts as a tally done.
    expect(computeStats(r, '2026-09-08').totalCompleted).toBe(2);
  });

  it('rates completion against scheduled days only', () => {
    // Two weeks of Mon/Wed/Fri = 6 due; 3 done.
    const r = routine(MON, ['2026-09-07', '2026-09-09', '2026-09-11'], sched);
    expect(calculateCompletionRate(r, r.completed, '2026-09-18')).toBe(50);
  });
});

describe('editing a schedule does not corrupt history', () => {
  it('re-reads the same completions under the new schedule', () => {
    const completed = ['2026-09-07', '2026-09-08', '2026-09-09'];
    const asDaily = routine(MON, completed, { frequency: 'daily' });
    const asMWF = routine(MON, completed, { frequency: 'weekly', weekdays: [1, 3, 5] });

    // Same records, different interpretation — and nothing was rewritten.
    expect(computeStats(asDaily, '2026-09-09').currentStreak).toBe(3);
    expect(computeStats(asMWF, '2026-09-09').currentStreak).toBe(2);   // Tue no longer counts
    expect(asDaily.completed).toEqual(completed);
    expect(asMWF.completed).toEqual(completed);
  });
});

describe('recovery', () => {
  it('counts scheduled days completed since the last miss', () => {
    const r = routine('2026-09-01', [
      '2026-09-01', '2026-09-02',        // early run
      /* 09-03 missed */
      '2026-09-04', '2026-09-05', '2026-09-06',
    ]);
    expect(calculateRecoveryStreak(r, r.completed, '2026-09-06')).toBe(3);
  });

  it('is zero when nothing has ever been missed', () => {
    const r = routine('2026-09-01', ['2026-09-01', '2026-09-02']);
    expect(calculateRecoveryStreak(r, r.completed, '2026-09-02')).toBe(0);
  });
});

describe('computeStats', () => {
  it('reports a coherent picture', () => {
    const r = routine('2026-09-01', ['2026-09-01', '2026-09-02', '2026-09-04', '2026-09-05']);
    const s = computeStats(r, '2026-09-05');
    expect(s.currentStreak).toBe(2);
    expect(s.bestStreak).toBe(2);
    expect(s.totalCompleted).toBe(4);
    expect(s.missedDays).toBe(1);              // 09-03
    expect(s.daysSinceStart).toBe(5);
    expect(s.scheduledDays).toBe(5);
    expect(s.completionPct).toBe(80);
    expect(s.prevSegments).toHaveLength(1);
    expect(s.currentSegment.dates).toEqual(['2026-09-04', '2026-09-05']);
  });

  it('survives an empty routine', () => {
    const s = computeStats(routine('2026-09-01', []), '2026-09-05');
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(0);
    expect(s.completionPct).toBe(0);
    expect(s.brokenStreak).toBeNull();
  });

  it('survives no routine at all', () => {
    expect(computeStats(null).currentStreak).toBe(0);
  });

  it('ignores dates in the future', () => {
    const r = routine('2026-09-01', ['2026-09-01', '2099-01-01']);
    const s = computeStats(r, '2026-09-01');
    expect(s.currentStreak).toBe(1);
    expect(s.scheduledDays).toBe(1);
  });

  it('handles a habit that has not started yet', () => {
    const r = routine('2099-01-01', []);
    const s = computeStats(r, '2026-09-01');
    expect(s.scheduledDays).toBe(0);
    expect(s.currentStreak).toBe(0);
  });
});

describe('achievement dates', () => {
  it('reports the earliest day a length was reached', () => {
    const r = routine('2026-09-01', datesBetween('2026-09-01', '2026-09-10'));
    expect(getAchievementDate(r, 7, '2026-09-10')).toBe('2026-09-07');
  });

  it('returns null when never reached', () => {
    const r = routine('2026-09-01', ['2026-09-01']);
    expect(getAchievementDate(r, 7, '2026-09-01')).toBeNull();
  });
});

describe('segments', () => {
  it('splits runs at missed scheduled days', () => {
    const r = routine('2026-09-01', ['2026-09-01', '2026-09-03', '2026-09-04']);
    const segs = computeSegments(r, r.completed, '2026-09-04');
    expect(segs.map((s) => s.dates.length)).toEqual([1, 2]);
  });
});
