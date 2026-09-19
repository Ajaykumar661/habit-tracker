import { useEffect, useMemo, useState } from 'react';
import { loadOrInitState, saveState, makeId } from '../lib/storage';
import { computeStats } from '../lib/streaks';
import { ACHIEVEMENTS } from '../lib/achievements';
import { todayStr } from '../lib/dates';

export function useTallyWallState() {
  const [state, setState] = useState(() => loadOrInitState());

  useEffect(() => { saveState(state); }, [state]);

  const activeRoutine = state.routines.find((r) => r.id === state.activeRoutineId) || state.routines[0];
  const stats = useMemo(() => computeStats(activeRoutine), [activeRoutine]);

  function selectRoutine(id) {
    if (id === state.activeRoutineId) return;
    setState((s) => ({ ...s, activeRoutineId: id }));
  }

  function addRoutine(name, startDate) {
    const r = {
      id: makeId(),
      name: (name || 'MY ROUTINE').toUpperCase(),
      startDate: startDate || todayStr(),
      completed: [],
      seenMilestones: [],
    };
    setState((s) => ({ routines: [...s.routines, r], activeRoutineId: r.id }));
    return r;
  }

  function deleteRoutine(id) {
    setState((s) => {
      const routines = s.routines.filter((x) => x.id !== id);
      const activeRoutineId = s.activeRoutineId === id ? routines[0].id : s.activeRoutineId;
      return { routines, activeRoutineId };
    });
  }

  // Adds a completion and synchronously computes the "celebration" info
  // (group-complete / milestone) from the hypothetical next state, so the
  // caller can trigger sound/animation immediately without waiting on a
  // React re-render.
  function addCompletion(dateStr) {
    if (!activeRoutine || activeRoutine.completed.includes(dateStr)) return null;

    const updatedRoutine = { ...activeRoutine, completed: [...activeRoutine.completed, dateStr].sort() };
    const newStats = computeStats(updatedRoutine);
    const justCompletedGroup = newStats.currentStreak > 0 && newStats.currentStreak % 5 === 0
      && newStats.currentSegment && newStats.currentSegment.dates.includes(dateStr);

    let milestone = null;
    for (const a of ACHIEVEMENTS) {
      if (newStats.currentStreak === a.days && !activeRoutine.seenMilestones.includes(a.days)) {
        milestone = a;
        break;
      }
    }

    setState((s) => ({
      ...s,
      routines: s.routines.map((r) => {
        if (r.id !== s.activeRoutineId) return r;
        return {
          ...updatedRoutine,
          seenMilestones: milestone ? [...r.seenMilestones, milestone.days] : r.seenMilestones,
        };
      }),
    }));

    return { justCompletedGroup, milestone, newStats };
  }

  function removeCompletion(dateStr) {
    setState((s) => ({
      ...s,
      routines: s.routines.map((r) => (
        r.id === s.activeRoutineId ? { ...r, completed: r.completed.filter((d) => d !== dateStr) } : r
      )),
    }));
  }

  return {
    routines: state.routines,
    activeRoutine,
    stats,
    selectRoutine,
    addRoutine,
    deleteRoutine,
    addCompletion,
    removeCompletion,
  };
}
