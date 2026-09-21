import { describe, it, expect } from 'vitest';
import { widgetSnapshot, widgetViewFor, WIDGET_LOOKAHEAD } from './widget';
import { createHabit } from './schema';

const TODAY = '2026-09-21';                     // a Monday
const read = createHabit({ id: 'read', name: 'READ', startDate: '2026-09-01' });
const gym = createHabit({ id: 'gym', name: 'GYM', startDate: '2026-09-01', schedule: { frequency: 'weekly', weekdays: [1] } });
const done = (id, date) => ({ [id]: { [date]: { id: 'c', habitId: id, date, completed: true } } });

const snap = (over = {}) => widgetSnapshot({
  habits: [read, gym], completions: {}, activeRoutine: read, streak: 12, today: TODAY, theme: 'medieval', ...over,
});

describe('the snapshot sent to the widget', () => {
  it('carries the day, the routine and its streak', () => {
    const s = snap();
    expect(s).toMatchObject({ date: TODAY, name: 'READ', streak: 12, theme: 'medieval', done: 0, total: 2 });
  });

  it('counts only what is done today', () => {
    expect(snap({ completions: done('read', TODAY) }).done).toBe(1);
  });

  it('sends what is due over the next few days', () => {
    const s = snap();
    expect(Object.keys(s.due)).toHaveLength(WIDGET_LOOKAHEAD);
    expect(s.due).toEqual({ '2026-09-21': 2, '2026-09-22': 1, '2026-09-23': 1 });
  });

  it('knows whether the active routine is done and due', () => {
    expect(snap().activeDone).toBe(false);
    expect(snap({ completions: done('read', TODAY) }).activeDone).toBe(true);
    expect(snap({ activeRoutine: gym, today: '2026-09-22' }).activeDue).toBe(false);
  });

  it('is plain data the phone can store', () => {
    const s = snap();
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });
});

describe('what the widget shows as days pass', () => {
  it('shows the snapshot as-is on its own day', () => {
    expect(widgetViewFor(snap({ completions: done('read', TODAY) }), TODAY)).toEqual({ streak: 12, done: 1, total: 2, stale: false });
  });

  it('starts the next day at zero, with that day’s own total', () => {
    const v = widgetViewFor(snap({ completions: done('read', TODAY) }), '2026-09-22');
    expect(v).toEqual({ streak: 12, done: 0, total: 1, stale: false });
  });

  it('never carries a streak over a day it was not logged', () => {
    expect(widgetViewFor(snap(), '2026-09-22').streak).toBeNull();
  });

  it('carries a streak over a day the routine was not due', () => {
    const s = snap({ activeRoutine: gym, today: '2026-09-22' });
    expect(widgetViewFor(s, '2026-09-23').streak).toBe(12);
  });

  it('stops guessing after a longer gap', () => {
    const v = widgetViewFor(snap({ completions: done('read', TODAY) }), '2026-09-24');
    expect(v.stale).toBe(true);
    expect(v.streak).toBeNull();
  });
});
