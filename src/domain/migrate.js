// Versioned migrations for stored state.
//
// The app shipped before it had a schemaVersion at all, so "v1" is detected
// structurally: a `routines` array whose entries carry a flat `completed`
// list of date strings. Every migration is pure — it takes a blob and
// returns a blob — so it can be tested without a browser and replayed over
// an imported file exactly as over localStorage.
//
// Rule: migrations never discard information they cannot represent. Where v1
// simply had no equivalent (a completion's time of day, for instance) the
// new field is left absent rather than invented.

import {
  SCHEMA_VERSION, createHabit, normalizeState, emptyState, makeId,
} from './schema';

/** Is this the original, version-less shape? */
export function isLegacyV1(raw) {
  return !!raw
    && typeof raw === 'object'
    && raw.schemaVersion === undefined
    && Array.isArray(raw.routines);
}

/**
 * v1 -> v2
 *
 * A v1 "routine" was implicitly a daily boolean habit, so that is exactly
 * what it becomes. Its `completed` date list expands into one Completion per
 * date. `startDate`, `seenMilestones` and `mournedStreakEnd` carry across
 * untouched so streak history and already-seen milestones stay correct.
 */
export function migrateV1toV2(raw) {
  const habits = [];
  const completions = {};

  for (const r of raw.routines || []) {
    if (!r) continue;
    const habit = createHabit({
      id: r.id,
      name: r.name,
      type: 'boolean',
      schedule: { frequency: 'daily' },
      difficulty: 'normal',
      startDate: r.startDate,
      // v1 never recorded when a routine was made; its first tracked day is
      // the best available answer, and is never later than the truth.
      createdAt: r.startDate ? `${r.startDate}T00:00:00.000Z` : undefined,
      seenMilestones: r.seenMilestones,
      mournedStreakEnd: r.mournedStreakEnd,
    });
    habits.push(habit);

    const byDate = {};
    for (const date of [...new Set(r.completed || [])].sort()) {
      // completedAt is deliberately omitted: v1 stored no time of day, and
      // inventing one would make "completed after 10pm" style achievements
      // silently wrong about the past.
      byDate[date] = { id: makeId(), habitId: habit.id, date, completed: true };
    }
    completions[habit.id] = byDate;
  }

  return normalizeState({
    schemaVersion: 2,
    habits,
    completions,
    activeHabitId: raw.activeRoutineId ?? habits[0]?.id ?? null,
    settings: {},
  });
}

const STEPS = [
  { from: 1, to: 2, run: migrateV1toV2 },
];

/**
 * Bring any supported blob up to the current schema.
 * @returns {{ state: object, migratedFrom: number|null, notes: string[] }}
 */
export function migrateState(raw) {
  const notes = [];
  if (!raw || typeof raw !== 'object') {
    return { state: emptyState(), migratedFrom: null, notes: ['no stored state'] };
  }

  let version = isLegacyV1(raw) ? 1 : Number(raw.schemaVersion);
  const startedAt = Number.isFinite(version) ? version : null;

  if (!Number.isFinite(version)) {
    return { state: emptyState(), migratedFrom: null, notes: ['unrecognised state shape'] };
  }
  if (version > SCHEMA_VERSION) {
    // Written by a newer build. Normalising keeps whatever this version
    // understands rather than refusing outright and stranding the user.
    notes.push(`state is from a newer version (${version}); reading what is understood`);
    return { state: normalizeState(raw), migratedFrom: startedAt, notes };
  }

  let state = raw;
  while (version < SCHEMA_VERSION) {
    const step = STEPS.find((s) => s.from === version);
    if (!step) {
      notes.push(`no migration path from version ${version}`);
      return { state: emptyState(), migratedFrom: startedAt, notes };
    }
    state = step.run(state);
    version = step.to;
    notes.push(`migrated ${step.from} -> ${step.to}`);
  }

  return { state: normalizeState(state), migratedFrom: startedAt, notes };
}
