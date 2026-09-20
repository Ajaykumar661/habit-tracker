// What "done" means, for every kind of habit.
//
// One rule table, consulted by the streak engine, the XP engine, the wall and
// the quest board alike. Adding a habit type should mean adding an entry here
// and nothing else — no component may decide completion for itself.

/** Duration is stored in seconds; these keep the conversions in one place. */
export const SECONDS_PER_MINUTE = 60;

const clampValue = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const targetOf = (habit) => Math.max(1, Number(habit?.target) || 1);

export const TYPE_RULES = {
  boolean: {
    label: 'DONE OR NOT',
    isComplete: (_habit, rec) => !!rec && rec.completed !== false,
    valueOf: (_habit, rec) => (rec && rec.completed !== false ? 1 : 0),
    targetOf: () => 1,
    format: (_habit, value) => (value >= 1 ? 'DONE' : 'NOT DONE'),
    formatProgress: (_habit, value) => (value >= 1 ? 'DONE' : '—'),
  },

  count: {
    label: 'A NUMBER OF TIMES',
    isComplete: (habit, rec) => clampValue(rec?.value) >= targetOf(habit),
    valueOf: (_habit, rec) => clampValue(rec?.value),
    targetOf,
    format: (habit, value) => `${clampValue(value)} / ${targetOf(habit)}${habit.unit ? ` ${habit.unit}` : ''}`,
    formatProgress: (habit, value) => `${clampValue(value)} / ${targetOf(habit)}`,
  },

  duration: {
    label: 'FOR A LENGTH OF TIME',
    isComplete: (habit, rec) => clampValue(rec?.value) >= targetOf(habit),
    valueOf: (_habit, rec) => clampValue(rec?.value),
    targetOf,
    format: (habit, value) => `${formatDuration(clampValue(value))} / ${formatDuration(targetOf(habit))}`,
    formatProgress: (habit, value) => `${formatDuration(clampValue(value))} / ${formatDuration(targetOf(habit))}`,
  },

  numeric: {
    label: 'TO AN AMOUNT',
    isComplete: (habit, rec) => clampValue(rec?.value) >= targetOf(habit),
    valueOf: (_habit, rec) => clampValue(rec?.value),
    targetOf,
    format: (habit, value) => `${clampValue(value)} / ${targetOf(habit)}${habit.unit ? ` ${habit.unit}` : ''}`,
    formatProgress: (habit, value) => `${clampValue(value)} / ${targetOf(habit)}`,
  },
};

function rulesFor(habit) {
  return TYPE_RULES[habit?.type] || TYPE_RULES.boolean;
}

/** MM:SS under an hour, H:MM:SS above it. */
export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** The single answer to "was this habit done on this day". */
export function isComplete(habit, record) {
  return rulesFor(habit).isComplete(habit, record);
}

/** Amount logged, in the habit's own units (seconds for duration). */
export function valueOf(habit, record) {
  return rulesFor(habit).valueOf(habit, record);
}

export function targetFor(habit) {
  return rulesFor(habit).targetOf(habit);
}

/** Progress for display: value, target, and a 0-100 percentage. */
export function progressOf(habit, record) {
  const value = valueOf(habit, record);
  const target = targetFor(habit);
  return {
    value,
    target,
    pct: Math.min(100, Math.round((value / target) * 100)),
    complete: isComplete(habit, record),
    text: rulesFor(habit).formatProgress(habit, value),
  };
}

/** Whether this type is logged as an amount rather than a yes/no. */
export function isMeasuredType(type) {
  return type === 'count' || type === 'duration' || type === 'numeric';
}

/**
 * How much a single tap should add. Count habits step by one; numeric and
 * duration habits step by a sensible slice of their target so reaching it
 * doesn't take dozens of presses.
 */
export function stepFor(habit) {
  if (habit?.type === 'count') return 1;
  if (habit?.type === 'duration') return 5 * SECONDS_PER_MINUTE;
  if (habit?.type === 'numeric') return Math.max(1, Math.round(targetFor(habit) / 10));
  return 1;
}

/** Default unit text, used as placeholder guidance when creating a habit. */
export const UNIT_SUGGESTIONS = {
  count: 'GLASSES',
  numeric: 'PAGES',
  duration: 'MINUTES',
};
