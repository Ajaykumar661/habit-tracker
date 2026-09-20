// Schema constants, factories and validation for the stored app state.
//
// Everything that decides "is this blob usable?" lives here, so storage and
// import share exactly one answer and can't drift apart.

import { todayStr, clampCutoff } from '../lib/dates';

/** Bump on every breaking shape change, and add a step in migrate.js. */
export const SCHEMA_VERSION = 2;

/** Legacy key (v1). Kept so the old blob can still be read and migrated. */
export const LEGACY_KEY = 'tally-wall-state-v1';
export const STORAGE_KEY = 'tally-wall-state';

export const HABIT_TYPES = ['boolean', 'count', 'duration', 'numeric'];
export const DIFFICULTIES = ['easy', 'normal', 'hard'];

export const DEFAULT_SETTINGS = {
  // Hours after midnight that still belong to the previous day. 0 = calendar
  // midnight. Kept here so Phase 22's cutoff has one home from the start.
  dayCutoffHour: 0,
  // Has the guide been read? Stored rather than derived, because "have you
  // seen this" is not a fact the completion record could ever answer.
  seenGuide: false,
};

export function makeId() {
  // Timestamp prefix keeps ids roughly sortable by creation, random suffix
  // avoids collisions when several are made in the same millisecond.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Types that measure an amount, and therefore need a target. */
export function isMeasured(type) {
  return type === 'count' || type === 'duration' || type === 'numeric';
}

/** @returns {import('./types').Habit} */
export function createHabit(input = {}) {
  const type = HABIT_TYPES.includes(input.type) ? input.type : 'boolean';
  const frequency = input.schedule?.frequency === 'weekly' ? 'weekly' : 'daily';
  const weekdays = Array.isArray(input.schedule?.weekdays)
    ? [...new Set(input.schedule.weekdays)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort()
    : [];
  return {
    id: input.id || makeId(),
    name: (input.name || 'MY ROUTINE').toUpperCase(),
    type,
    schedule: { frequency, weekdays: frequency === 'weekly' ? weekdays : [] },
    target: isMeasured(type) ? Math.max(1, Number(input.target) || 1) : undefined,
    unit: isMeasured(type) ? (input.unit || '') : undefined,
    difficulty: DIFFICULTIES.includes(input.difficulty) ? input.difficulty : 'normal',
    startDate: input.startDate || todayStr(),
    createdAt: input.createdAt || new Date().toISOString(),
    archivedAt: input.archivedAt || null,
    seenMilestones: Array.isArray(input.seenMilestones) ? [...input.seenMilestones] : [],
    mournedStreakEnd: input.mournedStreakEnd ?? null,
    acknowledgedShield: input.acknowledgedShield ?? null,
    // Why a run ended, keyed by that run's last completed day. Set only
    // by the user — never inferred.
    breakReasons: (input.breakReasons && typeof input.breakReasons === 'object') ? { ...input.breakReasons } : {},
  };
}

/** @returns {import('./types').Completion} */
export function createCompletion(habitId, date, input = {}) {
  return {
    id: input.id || makeId(),
    habitId,
    date,
    completed: input.completed !== false,
    ...(input.value === undefined ? {} : { value: Number(input.value) }),
    ...(input.note === undefined ? {} : { note: String(input.note) }),
    completedAt: input.completedAt || new Date().toISOString(),
  };
}

/**
 * Repair an existing record without inventing anything.
 *
 * Deliberately NOT createCompletion: that stamps `completedAt` with "now",
 * which would forge a time of day onto history that never had one (v1 stored
 * dates only). Absent stays absent.
 */
export function normalizeCompletion(habitId, date, c = {}) {
  const out = {
    id: typeof c.id === 'string' && c.id ? c.id : makeId(),
    habitId,
    date,
    completed: c.completed !== false,
  };
  if (c.value !== undefined && Number.isFinite(Number(c.value))) out.value = Number(c.value);
  if (c.note !== undefined) out.note = String(c.note);
  if (c.completedAt) out.completedAt = c.completedAt;
  return out;
}

export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    habits: [],
    completions: {},
    // A day's note belongs to the day, not to any one habit — see Phase 16.
    notes: {},
    activeHabitId: null,
    settings: { ...DEFAULT_SETTINGS },
  };
}

export function initialState() {
  const habit = createHabit({ name: 'MY ROUTINE' });
  return { ...emptyState(), habits: [habit], activeHabitId: habit.id };
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Structural check. Returns a list of problems; empty means usable.
 * Deliberately strict about shape and lenient about unknown extra keys, so
 * a newer build's export can still be read by an older one.
 * @returns {string[]}
 */
export function validateState(state) {
  const errs = [];
  if (!state || typeof state !== 'object') return ['not an object'];
  if (!Array.isArray(state.habits)) errs.push('habits is not an array');
  if (!state.completions || typeof state.completions !== 'object') errs.push('completions is not an object');
  if (errs.length) return errs;

  const ids = new Set();
  state.habits.forEach((h, i) => {
    if (!h || typeof h.id !== 'string' || !h.id) errs.push(`habit[${i}] has no id`);
    else if (ids.has(h.id)) errs.push(`habit[${i}] duplicate id ${h.id}`);
    else ids.add(h.id);
    if (typeof h?.name !== 'string') errs.push(`habit[${i}] has no name`);
    if (!HABIT_TYPES.includes(h?.type)) errs.push(`habit[${i}] bad type ${h?.type}`);
    if (!h?.schedule || !['daily', 'weekly'].includes(h.schedule.frequency)) {
      errs.push(`habit[${i}] bad schedule`);
    }
    if (isMeasured(h?.type) && !(Number(h?.target) > 0)) errs.push(`habit[${i}] needs a target`);
    if (h?.startDate && !DATE_RE.test(h.startDate)) errs.push(`habit[${i}] bad startDate`);
  });

  for (const [habitId, byDate] of Object.entries(state.completions)) {
    if (!ids.has(habitId)) errs.push(`completions for unknown habit ${habitId}`);
    if (!byDate || typeof byDate !== 'object') {
      errs.push(`completions[${habitId}] is not an object`);
      continue;
    }
    for (const [date, c] of Object.entries(byDate)) {
      if (!DATE_RE.test(date)) errs.push(`completions[${habitId}] bad date key ${date}`);
      if (!c || typeof c !== 'object') errs.push(`completions[${habitId}][${date}] is not an object`);
      else if (c.date !== date) errs.push(`completions[${habitId}][${date}] date mismatch`);
    }
  }
  return errs;
}

/** Fill in anything a valid-but-older-shaped state is missing. */
export function normalizeState(state) {
  const habits = (state.habits || []).map((h) => createHabit(h));
  const ids = new Set(habits.map((h) => h.id));
  // Every habit gets an entry, even an empty one, so `completions[id]` is
  // never undefined anywhere downstream. It also makes the nested index and
  // the flat export round-trip exactly: the flat form carries no record for
  // a habit with nothing logged, and the habits list is what restores it.
  const completions = {};
  for (const h of habits) completions[h.id] = {};
  for (const [habitId, byDate] of Object.entries(state.completions || {})) {
    if (!ids.has(habitId)) continue;            // drop orphans rather than fail
    for (const [date, c] of Object.entries(byDate || {})) {
      completions[habitId][date] = normalizeCompletion(habitId, date, c);
    }
  }
  const activeHabitId = ids.has(state.activeHabitId) ? state.activeHabitId : (habits[0]?.id ?? null);
  // Additive since v2: an older file simply has none, so no migration step
  // is needed — only a default.
  const notes = {};
  for (const [date, text] of Object.entries(state.notes || {})) {
    if (DATE_RE.test(date) && typeof text === 'string' && text.trim()) notes[date] = text;
  }
  return {
    schemaVersion: SCHEMA_VERSION,
    habits,
    completions,
    notes,
    activeHabitId,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(state.settings || {}),
      // Clamped on the way in as well as on the way out: a value edited by
      // hand or written by an older build must not decide which day a
      // completion lands on.
      dayCutoffHour: clampCutoff(state.settings?.dayCutoffHour ?? DEFAULT_SETTINGS.dayCutoffHour),
    },
  };
}
