import { todayStr } from './dates';

const STORAGE_KEY = 'tally-wall-state-v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt state */ }
  return null;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

export function createDefaultRoutine() {
  return {
    id: makeId(),
    name: 'MY ROUTINE',
    startDate: todayStr(),
    completed: [],
    seenMilestones: [],
  };
}

export function loadOrInitState() {
  const state = loadState();
  if (!state || !Array.isArray(state.routines) || state.routines.length === 0) {
    const r = createDefaultRoutine();
    const fresh = { routines: [r], activeRoutineId: r.id };
    saveState(fresh);
    return fresh;
  }
  state.routines.forEach((r) => { if (!r.seenMilestones) r.seenMilestones = []; });
  return state;
}
