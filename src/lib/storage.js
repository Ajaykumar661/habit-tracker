// Persistence. The only place that talks to localStorage.
//
// Reads run the stored blob through migration and validation before the app
// ever sees it, so the rest of the code can assume a current, well-formed
// state. A blob that cannot be salvaged is preserved under a backup key
// rather than overwritten — losing a chronicle to a parse error would be
// unforgivable in an app with no server copy.

import {
  STORAGE_KEY, LEGACY_KEY, SCHEMA_VERSION,
  initialState, emptyState, validateState, normalizeState, makeId,
} from '../domain/schema';
import { migrateState } from '../domain/migrate';

export { makeId };

function readRaw() {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return { raw: JSON.parse(current), key: STORAGE_KEY };
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) return { raw: JSON.parse(legacy), key: LEGACY_KEY };
  } catch {
    return { raw: null, key: null, corrupt: true };
  }
  return { raw: null, key: null };
}

function quarantine(reason) {
  // Keep the unreadable bytes. They are the user's only copy.
  try {
    for (const key of [STORAGE_KEY, LEGACY_KEY]) {
      const raw = localStorage.getItem(key);
      if (raw) localStorage.setItem(`${key}-broken-${Date.now()}`, raw);
    }
    // eslint-disable-next-line no-console
    console.warn(`[tally-wall] ${reason}; previous state kept under a -broken- key`);
  } catch { /* storage unavailable — nothing more we can do */ }
}

/** @returns {import('../domain/types').AppState} */
export function loadState() {
  const { raw, corrupt } = readRaw();
  if (corrupt) {
    quarantine('stored state could not be parsed');
    return null;
  }
  if (!raw) return null;

  const { state, notes } = migrateState(raw);
  const errs = validateState(state);
  if (errs.length) {
    quarantine(`stored state failed validation (${errs.slice(0, 3).join('; ')})`);
    return null;
  }
  if (notes.length && import.meta.env?.DEV) {
    // eslint-disable-next-line no-console
    console.info('[tally-wall] storage:', notes.join(', '));
  }
  return state;
}

export function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }));
    // The v1 key is only removed once a v2 write has succeeded, so an
    // interrupted migration can still be retried from the original.
    if (localStorage.getItem(LEGACY_KEY)) localStorage.removeItem(LEGACY_KEY);
  } catch { /* quota or private mode — the session still works in memory */ }
}

export function loadOrInitState() {
  const state = loadState();
  if (state && state.habits.length) return state;
  const fresh = state ? normalizeState({ ...emptyState(), ...state }) : initialState();
  const seeded = fresh.habits.length ? fresh : initialState();
  saveState(seeded);
  return seeded;
}
