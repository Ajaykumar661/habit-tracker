// Export/import of the whole tally history as a plain JSON file.
//
// The app keeps everything on the device and talks to no server, which is the
// point — but it also means a cleared app or a lost phone is the end of the
// record. This is the escape hatch: a file the owner keeps wherever they like.

import { loadState, saveState } from './storage';

const FORMAT = 'tally-wall-backup';
const VERSION = 1;

export function backupFilename(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `tally-wall-${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}.json`;
}

export function exportBackup() {
  const state = loadState();
  if (!state) throw new Error('Nothing to export yet.');
  const payload = { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), state };
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
  const routines = state.routines?.length || 0;
  const tallies = (state.routines || []).reduce((n, r) => n + (r.completed?.length || 0), 0);
  return { routines, tallies };
}

/** Throws with a readable reason if the file isn't a usable backup. */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const state = data && data.format === FORMAT ? data.state : data;
  if (!state || !Array.isArray(state.routines) || state.routines.length === 0) {
    throw new Error("That file doesn't look like a Tally Wall backup.");
  }
  for (const r of state.routines) {
    if (typeof r?.id !== 'string' || typeof r?.name !== 'string' || !Array.isArray(r?.completed)) {
      throw new Error('That backup is missing routine data.');
    }
  }
  const routines = state.routines.length;
  const tallies = state.routines.reduce((n, r) => n + r.completed.length, 0);
  return { state, routines, tallies };
}

/** Replaces everything on the device with the backup's contents. */
export function restoreBackup(state) {
  const routines = state.routines.map((r) => ({
    ...r,
    completed: [...new Set(r.completed)].sort(),
    seenMilestones: Array.isArray(r.seenMilestones) ? r.seenMilestones : [],
  }));
  const activeRoutineId = routines.some((r) => r.id === state.activeRoutineId)
    ? state.activeRoutineId : routines[0].id;
  saveState({ routines, activeRoutineId });
}
