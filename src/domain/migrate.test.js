import { describe, it, expect } from 'vitest';
import { migrateState, isLegacyV1, migrateV1toV2 } from './migrate';
import { validateState, normalizeState, SCHEMA_VERSION, createHabit } from './schema';
import { flattenCompletions, nestCompletions, parseBackup, buildBackup } from '../lib/backup';

// A realistic v1 blob: exactly what shipped before the schema was versioned.
const v1 = () => ({
  routines: [
    {
      id: 'abc123',
      name: 'READ',
      startDate: '2026-08-01',
      completed: ['2026-08-03', '2026-08-01', '2026-08-02'],  // unsorted on purpose
      seenMilestones: [7],
      mournedStreakEnd: '2026-08-20',
    },
    { id: 'def456', name: 'GYM', startDate: '2026-09-01', completed: [], seenMilestones: [] },
  ],
  activeRoutineId: 'def456',
});

describe('v1 detection', () => {
  it('recognises the version-less shape', () => {
    expect(isLegacyV1(v1())).toBe(true);
  });
  it('does not mistake a current state for v1', () => {
    expect(isLegacyV1({ schemaVersion: 2, habits: [], completions: {} })).toBe(false);
  });
  it('ignores junk', () => {
    expect(isLegacyV1(null)).toBe(false);
    expect(isLegacyV1({ routines: 'nope' })).toBe(false);
  });
});

describe('v1 -> v2 migration', () => {
  it('preserves every habit and every tally', () => {
    const { state, migratedFrom, notes } = migrateState(v1());
    expect(migratedFrom).toBe(1);
    expect(notes.join()).toContain('1 -> 2');
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    expect(state.habits.map((h) => h.name)).toEqual(['READ', 'GYM']);
    expect(Object.keys(state.completions.abc123)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
    expect(Object.keys(state.completions.def456)).toEqual([]);
  });

  it('keeps ids, so nothing else that referenced them breaks', () => {
    const { state } = migrateState(v1());
    expect(state.habits.map((h) => h.id)).toEqual(['abc123', 'def456']);
    expect(state.activeHabitId).toBe('def456');
  });

  it('carries streak bookkeeping across', () => {
    const { state } = migrateState(v1());
    const read = state.habits.find((h) => h.id === 'abc123');
    expect(read.seenMilestones).toEqual([7]);
    expect(read.mournedStreakEnd).toBe('2026-08-20');
    expect(read.startDate).toBe('2026-08-01');
  });

  it('treats a v1 routine as a daily boolean habit', () => {
    const { state } = migrateState(v1());
    const read = state.habits[0];
    expect(read.type).toBe('boolean');
    expect(read.schedule).toEqual({ frequency: 'daily', weekdays: [] });
    expect(read.difficulty).toBe('normal');
    expect(read.archivedAt).toBeNull();
  });

  it('does not invent a completion time it never had', () => {
    const { state } = migrateState(v1());
    const rec = state.completions.abc123['2026-08-01'];
    expect(rec.completed).toBe(true);
    expect(rec.completedAt).toBeUndefined();
  });

  it('de-duplicates repeated dates', () => {
    const raw = v1();
    raw.routines[0].completed.push('2026-08-01', '2026-08-01');
    const { state } = migrateState(raw);
    expect(Object.keys(state.completions.abc123)).toHaveLength(3);
  });

  it('produces a state that validates', () => {
    const { state } = migrateState(v1());
    expect(validateState(state)).toEqual([]);
  });

  it('is idempotent — migrating an already-migrated state changes nothing', () => {
    const once = migrateState(v1()).state;
    const twice = migrateState(once).state;
    expect(twice).toEqual(once);
  });
});

describe('migrateState guards', () => {
  it('returns an empty state for junk rather than throwing', () => {
    for (const bad of [null, undefined, 42, 'nope', {}]) {
      const { state } = migrateState(bad);
      expect(validateState(state)).toEqual([]);
      expect(state.habits).toEqual([]);
    }
  });

  it('reads what it can from a newer schema instead of discarding it', () => {
    const future = {
      schemaVersion: SCHEMA_VERSION + 5,
      habits: [createHabit({ id: 'x', name: 'FUTURE' })],
      completions: { x: {} },
      activeHabitId: 'x',
    };
    const { state, notes } = migrateState(future);
    expect(state.habits).toHaveLength(1);
    expect(notes.join()).toContain('newer version');
  });

  it('drops completions belonging to a habit that no longer exists', () => {
    const orphaned = {
      schemaVersion: 2,
      habits: [createHabit({ id: 'keep' })],
      completions: { keep: {}, ghost: { '2026-01-01': { habitId: 'ghost', date: '2026-01-01', completed: true } } },
      activeHabitId: 'keep',
    };
    const { state } = migrateState(orphaned);
    expect(Object.keys(state.completions)).toEqual(['keep']);
    expect(validateState(state)).toEqual([]);
  });
});

describe('completion index <-> flat array', () => {
  it('round-trips through the flat export shape', () => {
    const { state } = migrateState(v1());
    const flat = flattenCompletions(state.completions);
    expect(flat).toHaveLength(3);
    // The flat form holds no record for a habit with nothing logged; the
    // habits list is what restores those, via normalizeState.
    const back = normalizeState({ ...state, completions: nestCompletions(flat) });
    expect(back.completions).toEqual(state.completions);
  });

  it('cannot produce two records for the same habit and day', () => {
    const nested = nestCompletions([
      { habitId: 'a', date: '2026-01-01', completed: true, value: 1 },
      { habitId: 'a', date: '2026-01-01', completed: true, value: 9 },
    ]);
    expect(Object.keys(nested.a)).toHaveLength(1);
    expect(nested.a['2026-01-01'].value).toBe(9);   // last write wins
  });
});

describe('backup import', () => {
  it('accepts a current export', () => {
    const { state } = migrateState(v1());
    const file = JSON.stringify(buildBackup(state));
    const parsed = parseBackup(file);
    expect(parsed.routines).toBe(2);
    expect(parsed.tallies).toBe(3);
    expect(validateState(parsed.state)).toEqual([]);
  });

  it('accepts a raw v1 file exported by the old build', () => {
    const parsed = parseBackup(JSON.stringify(v1()));
    expect(parsed.routines).toBe(2);
    expect(parsed.tallies).toBe(3);
    expect(parsed.state.habits[0].type).toBe('boolean');
  });

  it('rejects junk with a readable message', () => {
    expect(() => parseBackup('{oh no')).toThrow(/valid JSON/);
    expect(() => parseBackup('{"hello":"world"}')).toThrow(/Tally Wall backup/);
  });
});

describe('settings on the way in', () => {
  const base = { habits: [], completions: {} };

  it('supplies the defaults when there are none', () => {
    expect(normalizeState(base).settings.dayCutoffHour).toBe(0);
  });

  it('keeps a cutoff that is in range', () => {
    expect(normalizeState({ ...base, settings: { dayCutoffHour: 4 } }).settings.dayCutoffHour).toBe(4);
  });

  it('clamps a cutoff that is out of range rather than trusting it', () => {
    // Which day a completion lands on must never depend on an edited file.
    expect(normalizeState({ ...base, settings: { dayCutoffHour: 99 } }).settings.dayCutoffHour).toBe(6);
    expect(normalizeState({ ...base, settings: { dayCutoffHour: -3 } }).settings.dayCutoffHour).toBe(0);
  });

  it('falls back to midnight for a value that is not a number', () => {
    expect(normalizeState({ ...base, settings: { dayCutoffHour: 'late' } }).settings.dayCutoffHour).toBe(0);
  });

  it('leaves other settings alone', () => {
    const out = normalizeState({ ...base, settings: { dayCutoffHour: 2, somethingElse: 'kept' } });
    expect(out.settings.somethingElse).toBe('kept');
  });
});
