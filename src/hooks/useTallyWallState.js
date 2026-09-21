import { useEffect, useMemo, useState } from 'react';
import { loadOrInitState, saveState } from '../lib/storage';
import { createHabit, createCompletion, DEFAULT_SETTINGS, THEME_IDS } from '../domain/schema';
import { computeStats } from '../domain/streaks';
import { isUntouchedStart } from '../domain/starters';
import { isComplete, valueOf, stepFor, targetFor } from '../domain/completion';
import { computeProgression } from '../domain/xp';
import { buildQuestBoard } from '../domain/quests';
import { applyEdit } from '../domain/editing';
import { ACHIEVEMENTS } from '../lib/achievements';
import { habitToday, clampCutoff } from '../lib/dates';

// Owns the stored state and exposes it to the UI.
//
// The model underneath is habits + separate completion records, but this hook
// still hands components the flat `routine.completed` array they were written
// against. That adapter is deliberate: it lets the data model grow without a
// UI rewrite in the same change.

/**
 * Habit + its records, in the shape the existing components expect.
 * `completed` means "met this habit's own definition of done", so a water
 * counter sitting at 6/8 is progress, not a tally.
 */
function toRoutineView(habit, completions) {
  const byDate = completions[habit.id] || {};
  return {
    ...habit,
    records: byDate,
    completed: Object.keys(byDate).filter((d) => isComplete(habit, byDate[d])).sort(),
  };
}

export function useTallyWallState() {
  const [state, setState] = useState(() => loadOrInitState());

  useEffect(() => { saveState(state); }, [state]);

  const routines = useMemo(
    () => state.habits.filter((h) => !h.archivedAt).map((h) => toRoutineView(h, state.completions)),
    [state.habits, state.completions],
  );
  const activeRoutine = routines.find((r) => r.id === state.activeHabitId) || routines[0];
  // Retired quests, newest first — shown only in settings.
  const archived = useMemo(
    () => state.habits.filter((h) => h.archivedAt)
      .map((h) => toRoutineView(h, state.completions))
      .sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt))),
    [state.habits, state.completions],
  );
  // One definition of "today" for the whole app, honouring the day cutoff.
  const today = habitToday(state.settings?.dayCutoffHour ?? 0);
  const stats = useMemo(() => computeStats(activeRoutine, today), [activeRoutine, today]);
  // Derived from history every time — see domain/xp.js for why it is never
  // stored. Memoised because it walks every day the habits have existed.
  const progression = useMemo(
    () => computeProgression(state.habits, state.completions, today),
    [state.habits, state.completions, today],
  );
  // Today's quest board: what is actually being asked of the user right now.
  const board = useMemo(
    () => buildQuestBoard(state.habits, state.completions, today),
    [state.habits, state.completions, today],
  );

  /** Any habit's view by id, defaulting to the one on the wall. */
  const viewFor = (habitId) => (
    habitId ? routines.find((r) => r.id === habitId) : activeRoutine
  );

  function selectRoutine(id) {
    if (id === state.activeHabitId) return;
    setState((s) => ({ ...s, activeHabitId: id }));
  }

  function addRoutine(name, startDate, options = {}) {
    const habit = createHabit({ ...options, name, startDate: startDate || today });
    setState((s) => ({
      ...s,
      habits: [...s.habits, habit],
      completions: { ...s.completions, [habit.id]: {} },
      activeHabitId: habit.id,
    }));
    return habit;
  }

  /**
   * First run: swap the untouched default routine for the one the user
   * picked. Only ever on a record with nothing in it (isUntouchedStart); on
   * anything else it simply adds, so no one's history can be replaced.
   */
  function startWith(name, options = {}) {
    if (!isUntouchedStart(state)) return addRoutine(name, options.startDate, options);
    const habit = createHabit({ ...options, name, startDate: options.startDate || today });
    setState((s) => ({ ...s, habits: [habit], completions: { [habit.id]: {} }, activeHabitId: habit.id }));
    return habit;
  }

  /**
   * Retiring a quest keeps its record.
   *
   * Removing a habit used to delete every tally with it, which is a year of
   * someone's life gone to one mis-tap. Archiving takes it off the board and
   * out of the wall rotation while leaving the chronicle intact, and it can
   * be brought back or genuinely erased from settings.
   */
  function deleteRoutine(id) {
    setState((s) => {
      const live = s.habits.filter((h) => !h.archivedAt && h.id !== id);
      if (!live.length) return s;               // never leave the wall habitless
      return {
        ...s,
        habits: s.habits.map((h) => (
          h.id === id ? { ...h, archivedAt: new Date().toISOString() } : h
        )),
        activeHabitId: s.activeHabitId === id ? live[0].id : s.activeHabitId,
      };
    });
  }

  /** Put an archived quest back on the board, record and all. */
  function restoreRoutine(id) {
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === id ? { ...h, archivedAt: null } : h)),
      activeHabitId: id,
    }));
  }

  /**
   * Erase an archived quest and its tallies for good. The only path in the
   * app that destroys history, reachable only from settings, and only for
   * something already archived.
   */
  function purgeRoutine(id) {
    setState((s) => {
      const habit = s.habits.find((h) => h.id === id);
      if (!habit?.archivedAt) return s;         // live quests are archived first
      const completions = { ...s.completions };
      delete completions[id];
      return { ...s, habits: s.habits.filter((h) => h.id !== id), completions };
    });
  }

  /**
   * Change a quest. Only the editable fields move; see domain/editing.js for
   * why type and start date are frozen.
   */
  function editRoutine(id, changes) {
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === id ? applyEdit(h, changes) : h)),
    }));
  }

  /**
   * Write one day's record and report what it triggered.
   *
   * Every kind of logging goes through here — ticking a boolean, filling a
   * counter, adding minutes — so "did this just become complete?" is decided
   * in one place. Returns null unless the day crossed from incomplete to
   * complete, so a celebration can never fire twice for the same day.
   */
  function recordDay(dateStr, patch, targetId) {
    const routine = viewFor(targetId);
    if (!routine) return null;
    const habitId = routine.id;
    const before = routine.records?.[dateStr];
    const wasComplete = isComplete(routine, before);

    const next = createCompletion(habitId, dateStr, { ...before, ...patch, id: before?.id });
    const nowComplete = isComplete(routine, next);

    // Work the celebration out from the hypothetical next state, so the
    // caller can fire sound and animation without waiting on a re-render.
    let celebration = null;
    if (nowComplete && !wasComplete) {
      const updatedView = { ...routine, completed: [...routine.completed, dateStr].sort() };
      const newStats = computeStats(updatedView, today);
      const milestone = ACHIEVEMENTS.find(
        (a) => newStats.currentStreak === a.days && !routine.seenMilestones.includes(a.days),
      ) || null;
      celebration = {
        justCompletedGroup: newStats.currentStreak > 0 && newStats.currentStreak % 5 === 0
          && !!newStats.currentSegment?.dates.includes(dateStr),
        milestone,
        newStats,
      };
    }

    const earned = celebration?.milestone;
    setState((s) => ({
      ...s,
      habits: earned
        ? s.habits.map((h) => (
          h.id === habitId ? { ...h, seenMilestones: [...h.seenMilestones, earned.days] } : h
        ))
        : s.habits,
      completions: {
        ...s.completions,
        [habitId]: { ...(s.completions[habitId] || {}), [dateStr]: next },
      },
    }));

    return celebration;
  }

  /** Mark a whole day done. Measured habits jump straight to their target. */
  function addCompletion(dateStr, detail = {}, targetId) {
    const routine = viewFor(targetId);
    if (!routine || routine.completed.includes(dateStr)) return null;
    const patch = routine.type === 'boolean'
      ? { completed: true, ...detail }
      : { completed: true, value: targetFor(routine), ...detail };
    return recordDay(dateStr, patch, routine.id);
  }

  /** Add to (or subtract from) a measured habit's running total for a day. */
  function addProgress(dateStr, delta, targetId) {
    const routine = viewFor(targetId);
    if (!routine) return null;
    const step = delta ?? stepFor(routine);
    const current = valueOf(routine, routine.records?.[dateStr]);
    const next = Math.max(0, current + step);
    if (next === 0) {                          // back to nothing logged
      removeCompletion(dateStr, routine.id);
      return null;
    }
    return recordDay(dateStr, { value: next, completed: true }, routine.id);
  }

  /** One tap on a quest: tick a boolean, or add a step to a measured one. */
  function advanceQuest(habitId, dateStr = today) {
    const routine = viewFor(habitId);
    if (!routine) return null;
    if (routine.type === 'boolean') {
      if (routine.completed.includes(dateStr)) {
        removeCompletion(dateStr, routine.id);
        return null;
      }
      return addCompletion(dateStr, {}, routine.id);
    }
    return addProgress(dateStr, undefined, routine.id);
  }

  function removeCompletion(dateStr, targetId) {
    const habitId = targetId || activeRoutine?.id;
    if (!habitId) return;
    setState((s) => {
      const byDate = { ...(s.completions[habitId] || {}) };
      delete byDate[dateStr];
      return { ...s, completions: { ...s.completions, [habitId]: byDate } };
    });
  }

  /** Record (or clear) why a run ended. `endedOn` is the run's last day. */
  function setBreakReason(endedOn, reason) {
    const habitId = activeRoutine?.id;
    if (!habitId) return;
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => {
        if (h.id !== habitId) return h;
        const breakReasons = { ...(h.breakReasons || {}) };
        if (reason) breakReasons[endedOn] = reason;
        else delete breakReasons[endedOn];
        return { ...h, breakReasons };
      }),
    }));
  }

  /** Write (or clear) the note for a day. Empty text removes the entry. */
  function setNote(dateStr, text) {
    setState((s) => {
      const notes = { ...(s.notes || {}) };
      if (text && text.trim()) notes[dateStr] = text.slice(0, 2000);
      else delete notes[dateStr];
      return { ...s, notes };
    });
  }

  /** Remember that this shield spend has been shown, so it shows once. */
  function acknowledgeShield(dateStr) {
    const habitId = activeRoutine?.id;
    if (!habitId) return;
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, acknowledgedShield: dateStr } : h)),
    }));
  }

  /** Mark this particular broken run as seen, so it isn't mourned again. */
  function acknowledgeStreakLoss(endedOn) {
    const habitId = activeRoutine?.id;
    if (!habitId) return;
    setState((s) => ({
      ...s,
      habits: s.habits.map((h) => (h.id === habitId ? { ...h, mournedStreakEnd: endedOn } : h)),
    }));
  }

  /**
   * Change a setting. The cutoff is clamped here rather than trusted from the
   * UI, because it decides which day every future completion lands on.
   */
  function setSetting(key, value) {
    // A theme the app doesn't ship would leave nothing to draw.
    if (key === 'theme' && !THEME_IDS.includes(value)) return;
    setState((s) => ({
      ...s,
      settings: {
        ...DEFAULT_SETTINGS,
        ...(s.settings || {}),
        [key]: key === 'dayCutoffHour' ? clampCutoff(value) : value,
      },
    }));
  }

  return {
    freshStart: isUntouchedStart(state),
    startWith,
    routines,
    activeRoutine,
    stats,
    progression,
    board,
    habits: state.habits,
    completions: state.completions,
    notes: state.notes || {},
    settings: state.settings,
    today,
    selectRoutine,
    addRoutine,
    editRoutine,
    deleteRoutine,
    restoreRoutine,
    purgeRoutine,
    archived,
    addCompletion,
    addProgress,
    advanceQuest,
    setNote,
    setBreakReason,
    removeCompletion,
    acknowledgeStreakLoss,
    acknowledgeShield,
    setSetting,
  };
}
