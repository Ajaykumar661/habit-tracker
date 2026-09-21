import { describe, it, expect } from 'vitest';
import {
  planReminders, reminderTimeOf, formatReminderTime, reminderIdFor,
  REMINDER_HORIZON, REMINDER_TIMES, DEFAULT_REMINDER_TIME,
} from './reminders';
import { createHabit } from './schema';

// Monday 21 Sep 2026, 10:00 local.
const NOW = new Date(2026, 8, 21, 10, 0);
const daily = createHabit({ id: 'read', name: 'READ', startDate: '2026-09-01' });
const on = { reminderOn: true, reminderTime: '20:00', dayCutoffHour: 0 };
const done = (id, date) => ({ [id]: { [date]: { id: 'c', habitId: id, date, completed: true } } });

describe('reminders stay quiet unless asked', () => {
  it('plans nothing while switched off', () => {
    expect(planReminders({ habits: [daily], completions: {}, settings: {}, now: NOW })).toEqual([]);
    expect(planReminders({ habits: [daily], completions: {}, settings: { ...on, reminderOn: false }, now: NOW })).toEqual([]);
  });

  it('plans at most one a day, and only a few days ahead', () => {
    const plan = planReminders({ habits: [daily], completions: {}, settings: on, now: NOW });
    expect(plan).toHaveLength(REMINDER_HORIZON);
    expect(new Set(plan.map((p) => p.date)).size).toBe(plan.length);
    expect(plan.map((p) => p.date)).toEqual(['2026-09-21', '2026-09-22', '2026-09-23']);
  });

  it('fires at the chosen time', () => {
    const [first] = planReminders({ habits: [daily], completions: {}, settings: { ...on, reminderTime: '07:30' }, now: new Date(2026, 8, 21, 6, 0) });
    expect(first.at).toEqual(new Date(2026, 8, 21, 7, 30));
  });

  it('skips today once today is finished', () => {
    const plan = planReminders({ habits: [daily], completions: done('read', '2026-09-21'), settings: on, now: NOW });
    expect(plan.map((p) => p.date)).not.toContain('2026-09-21');
    expect(plan).toHaveLength(REMINDER_HORIZON - 1);
  });

  it('never fires late for a time already passed', () => {
    const plan = planReminders({ habits: [daily], completions: {}, settings: on, now: new Date(2026, 8, 21, 21, 0) });
    expect(plan[0].date).toBe('2026-09-22');
  });

  it('stays silent on days nothing is due', () => {
    // Mondays only; the 21st is a Monday, the next two days are not.
    const monday = createHabit({ id: 'gym', name: 'GYM', startDate: '2026-09-01', schedule: { frequency: 'weekly', weekdays: [1] } });
    const plan = planReminders({ habits: [monday], completions: {}, settings: on, now: NOW });
    expect(plan.map((p) => p.date)).toEqual(['2026-09-21']);
  });

  it('says nothing about archived routines', () => {
    const gone = { ...daily, archivedAt: '2026-09-10T00:00:00.000Z' };
    expect(planReminders({ habits: [gone], completions: {}, settings: on, now: NOW })).toEqual([]);
  });

  it('plans nothing with no routines at all', () => {
    expect(planReminders({ habits: [], completions: {}, settings: on, now: NOW })).toEqual([]);
  });
});

describe('what a reminder says', () => {
  it('names a single open routine', () => {
    const [r] = planReminders({ habits: [daily], completions: {}, settings: on, now: NOW });
    expect(r.body).toContain('READ');
  });

  it('counts only what is still open', () => {
    const walk = createHabit({ id: 'walk', name: 'WALK', startDate: '2026-09-01' });
    const code = createHabit({ id: 'code', name: 'CODE', startDate: '2026-09-01' });
    const [today] = planReminders({ habits: [daily, walk, code], completions: done('read', '2026-09-21'), settings: on, now: NOW });
    expect(today.body).toMatch(/\b2\b/);
  });

  it('speaks in the theme it is handed', () => {
    const words = { title: 'NEON', one: (n) => `${n} pending`, many: (n) => `${n} pending` };
    const [r] = planReminders({ habits: [daily], completions: {}, settings: on, now: NOW, words });
    expect(r.title).toBe('NEON');
    expect(r.body).toBe('READ pending');
  });
});

describe('the late-night cutoff', () => {
  it('treats 1AM before a 4AM cutoff as still the day before', () => {
    const late = new Date(2026, 8, 22, 1, 0);
    const plan = planReminders({ habits: [daily], completions: {}, settings: { ...on, dayCutoffHour: 4 }, now: late });
    // "today" is the 21st, whose 8PM has passed, so the next is the 22nd.
    expect(plan[0].date).toBe('2026-09-22');
    expect(plan[0].at).toEqual(new Date(2026, 8, 22, 20, 0));
  });
});

describe('the small helpers', () => {
  it('falls back to the default time when the stored one is bad', () => {
    expect(reminderTimeOf({ reminderTime: '25:99' })).toBe(DEFAULT_REMINDER_TIME);
    expect(reminderTimeOf({})).toBe(DEFAULT_REMINDER_TIME);
    expect(reminderTimeOf({ reminderTime: '07:30' })).toBe('07:30');
  });

  it('offers half-hour steps from 6AM to 11:30PM', () => {
    expect(REMINDER_TIMES[0]).toBe('06:00');
    expect(REMINDER_TIMES.at(-1)).toBe('23:30');
    expect(REMINDER_TIMES).toContain(DEFAULT_REMINDER_TIME);
  });

  it('formats times for people', () => {
    expect(formatReminderTime('20:30')).toBe('8:30 PM');
    expect(formatReminderTime('12:00')).toBe('12:00 PM');
    expect(formatReminderTime('06:00')).toBe('6:00 AM');
  });

  it('gives each day its own id', () => {
    expect(reminderIdFor('2026-09-21')).toBe(20260921);
  });
});
