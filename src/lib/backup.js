// Export/import of the whole chronicle as a plain JSON file.
//
// The app keeps everything on the device and talks to no server, which is the
// point — but it also means a cleared app or a lost phone is the end of the
// record. This is the escape hatch: a file the owner keeps wherever they like.
//
// Exports carry a schemaVersion and flatten completions into an array (the
// portable, obvious shape). Imports run through the same migration path as
// localStorage, so a file written by an older build still restores.

import { loadState, saveState } from './storage';
import { SCHEMA_VERSION, validateState, normalizeState } from '../domain/schema';
import { migrateState } from '../domain/migrate';

const FORMAT = 'tally-wall-backup';

export function backupFilename(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `tally-wall-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

/** Nested completion index -> flat array, for a readable, portable file. */
export function flattenCompletions(completions) {
  const out = [];
  for (const byDate of Object.values(completions || {})) {
    for (const c of Object.values(byDate || {})) out.push(c);
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Flat array -> nested index. Later records win on a duplicate habit/day. */
export function nestCompletions(list) {
  const out = {};
  for (const c of list || []) {
    if (!c || typeof c.habitId !== 'string' || typeof c.date !== 'string') continue;
    (out[c.habitId] ||= {})[c.date] = c;
  }
  return out;
}

export function buildBackup(state) {
  return {
    format: FORMAT,
    version: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    habits: state.habits,
    completions: flattenCompletions(state.completions),
    notes: state.notes || {},
    settings: state.settings,
    activeHabitId: state.activeHabitId,
  };
}

export function exportBackup() {
  const state = loadState();
  if (!state) throw new Error('Nothing to export yet.');
  const payload = buildBackup(state);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = backupFilename();
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately can cancel the download on some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { routines: state.habits.length, tallies: payload.completions.length };
}

/**
 * Parse and validate a backup file's text.
 * Throws with a readable reason if it isn't usable.
 * @returns {{ state: object, routines: number, tallies: number }}
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  if (!data || typeof data !== 'object') throw new Error("That file isn't a Tally Wall backup.");

  // Three accepted shapes: a current export, a raw state blob, or a v1 file
  // from before the schema was versioned. migrateState sorts out which.
  const candidate = Array.isArray(data.completions)
    ? { ...data, schemaVersion: data.version ?? SCHEMA_VERSION, completions: nestCompletions(data.completions) }
    : data;

  const { state } = migrateState(candidate);
  if (!state.habits.length) throw new Error("That file doesn't look like a Tally Wall backup.");

  const errs = validateState(state);
  if (errs.length) throw new Error(`That backup is not usable (${errs[0]}).`);

  return {
    state: normalizeState(state),
    routines: state.habits.length,
    tallies: flattenCompletions(state.completions).length,
  };
}

/** Replaces everything on the device with the backup's contents. */
export function restoreBackup(state) {
  saveState(normalizeState(state));
}
