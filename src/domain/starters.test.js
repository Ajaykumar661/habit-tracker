import { describe, it, expect } from 'vitest';
import { STARTERS, isUntouchedStart } from './starters';
import { createHabit, initialState, validateState } from './schema';

describe('the starters', () => {
  it('each makes a valid routine', () => {
    for (const s of STARTERS) {
      const habit = createHabit({ ...s.options, name: s.name, startDate: '2026-09-21' });
      const state = { habits: [habit], completions: { [habit.id]: {} } };
      expect(validateState(state), s.id).toEqual([]);
      expect(habit.name).toBe(s.name);
    }
  });

  it('keeps their shape: a count has a target and a unit, a timed one is in seconds', () => {
    const water = createHabit({ ...STARTERS.find((s) => s.id === 'water').options, name: 'W' });
    expect(water).toMatchObject({ type: 'count', target: 8, unit: 'GLASSES' });
    const read = createHabit({ ...STARTERS.find((s) => s.id === 'read').options, name: 'R' });
    expect(read).toMatchObject({ type: 'duration', target: 1200 });
  });

  it('have unique ids and names', () => {
    expect(new Set(STARTERS.map((s) => s.id)).size).toBe(STARTERS.length);
    expect(new Set(STARTERS.map((s) => s.name)).size).toBe(STARTERS.length);
  });
});

describe('only an untouched first run is replaced', () => {
  it('recognises a brand-new install', () => {
    expect(isUntouchedStart(initialState())).toBe(true);
  });

  it('never replaces a routine with anything logged', () => {
    const s = initialState();
    const id = s.habits[0].id;
    s.completions = { [id]: { '2026-09-20': { id: 'c', habitId: id, date: '2026-09-20', completed: true } } };
    expect(isUntouchedStart(s)).toBe(false);
  });

  it('never replaces a routine the user renamed, or a second routine', () => {
    const s = initialState();
    expect(isUntouchedStart({ ...s, habits: [{ ...s.habits[0], name: 'PIANO' }] })).toBe(false);
    expect(isUntouchedStart({ ...s, habits: [...s.habits, createHabit({ name: 'B' })] })).toBe(false);
  });

  it('never replaces a day with a note on it', () => {
    expect(isUntouchedStart({ ...initialState(), notes: { '2026-09-20': 'hi' } })).toBe(false);
  });
});
