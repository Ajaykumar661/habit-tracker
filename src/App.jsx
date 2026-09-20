import { useEffect, useRef, useState } from 'react';
import { useAnimation, useReducedMotion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import TopBar from './components/TopBar';
import Sidebar from './components/Sidebar';
import DayNumber from './components/DayNumber';
import TallyWall from './components/TallyWall';
import ActionButtons from './components/ActionButtons';
import CellLog from './components/CellLog';
import StatsPanel from './components/StatsPanel';
import Achievements from './components/Achievements';
import Tooltip from './components/Tooltip';
import ConfirmModal from './components/ConfirmModal';
import AddRoutineModal from './components/AddRoutineModal';
import GroupPopover from './components/GroupPopover';
import AchievementPopup from './components/AchievementPopup';
import ParticleLayer from './components/ParticleLayer';
import QuotePlaque from './components/QuotePlaque';
import DevEnvSwitcher from './components/DevEnvSwitcher';
import GameView from './components/GameView';
import { useTallyWallState } from './hooks/useTallyWallState';
import { useEnvironmentState } from './hooks/useEnvironmentState';
import { SoundFX } from './lib/sound';
import { todayStr } from './lib/dates';
import { pickQuote } from './data/quotes';

let particleSeq = 0;

function startOfMonth() {
  const d = new Date();
  d.setDate(1);
  return d;
}

export default function App() {
  const {
    routines, activeRoutine, stats,
    selectRoutine, addRoutine, deleteRoutine, addCompletion, removeCompletion,
  } = useTallyWallState();

  const envState = useEnvironmentState();

  const [calendarCursor, setCalendarCursor] = useState(startOfMonth);
  const [tooltip, setTooltip] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [addRoutineOpen, setAddRoutineOpen] = useState(false);
  const [groupDates, setGroupDates] = useState(null);
  const [drawer, setDrawer] = useState(null); // 'routines' | 'record' | null — the mobile HUD drawer
  const [achievement, setAchievement] = useState(null);
  const [particles, setParticles] = useState([]);
  const [muted, setMuted] = useState(SoundFX.isMuted());
  const [freshDate, setFreshDate] = useState(null);
  const [quote, setQuote] = useState(() => pickQuote({ envState, currentStreak: stats.currentStreak }));

  const markBtnRef = useRef(null);
  const achievementTimeoutRef = useRef(null);
  const freshTimeoutRef = useRef(null);
  const skipNextQuoteEffect = useRef(false);
  const prevBestRef = useRef(stats.bestStreak);
  const jailControls = useAnimation();
  const appControls = useAnimation();
  const reducedMotion = useReducedMotion();

  const doneToday = activeRoutine.completed.includes(todayStr());

  // Ambient quote refresh: fires on load, on time-of-day change, and on any
  // streak change that celebrate() didn't already give a special quote to.
  useEffect(() => {
    if (skipNextQuoteEffect.current) { skipNextQuoteEffect.current = false; return; }
    setQuote((prev) => pickQuote({
      envState,
      currentStreak: stats.currentStreak,
      missedYesterday: stats.currentStreak === 0 && stats.totalCompleted > 0,
      excludeText: prev,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envState, stats.currentStreak]);

  // Android hardware back button: close whatever's open (native only — a
  // browser has no such button to listen for). Registering a listener hands
  // Capacitor's own back/exit behavior to us entirely, so the last case must
  // exit the app itself or the button would go dead with nothing left open.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const sub = CapApp.addListener('backButton', () => {
      if (achievement) { setAchievement(null); return; }
      if (confirm) { handleConfirmNo(); return; }
      if (groupDates) { handleCloseGroup(); return; }
      if (addRoutineOpen) { SoundFX.close(); setAddRoutineOpen(false); return; }
      if (drawer) { setDrawer(null); return; }
      CapApp.exitApp();
    });
    return () => { sub.then((h) => h.remove()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement, confirm, groupDates, addRoutineOpen, drawer]);

  function handleRerollQuote() {
    setQuote((prev) => pickQuote({ envState, currentStreak: stats.currentStreak, excludeText: prev }));
  }

  function showTooltip(e, text) { setTooltip({ text, x: e.clientX, y: e.clientY }); }
  function moveTooltip(e) { setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t)); }
  function hideTooltip() { setTooltip(null); }

  function spawnParticles(rect, big) {
    if (reducedMotion) return;
    // Kept deliberately subtle — a light dusting of pixel debris, not a
    // celebration burst, since a plain scratch on a wall doesn't erupt.
    const count = big ? 10 : 5;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const batch = [];
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
      const dist = (big ? 26 : 16) + Math.random() * 14;
      batch.push({
        id: ++particleSeq,
        x: cx,
        y: cy,
        dx: Math.cos(angle) * dist,
        dy: Math.sin(angle) * dist - 16,
        rotate: (Math.random() - 0.5) * 180,
        big,
        color: Math.random() > 0.5 ? 'var(--amber)' : 'var(--cream)',
      });
    }
    setParticles((p) => [...p, ...batch]);
  }
  function removeParticle(id) { setParticles((p) => p.filter((x) => x.id !== id)); }

  function shakeSmall() {
    if (reducedMotion) return;
    jailControls.start({ x: [0, -2, 2, -1, 0], y: [0, 1, -1, -1, 0], transition: { duration: 0.28 } });
  }
  function shakeBig() {
    if (reducedMotion) return;
    appControls.start({ x: [0, -4, 4, -3, 3, 0], y: [0, 3, -3, -3, 2, 0], transition: { duration: 0.4 } });
  }

  function celebrate(result, originRect, dateStr) {
    if (!result) return;
    const { justCompletedGroup, milestone, newStats } = result;

    // Briefly emphasize the new tally on the wall itself.
    setFreshDate(dateStr);
    clearTimeout(freshTimeoutRef.current);
    freshTimeoutRef.current = setTimeout(() => setFreshDate(null), 1400);

    spawnParticles(originRect, justCompletedGroup);
    if (justCompletedGroup) {
      SoundFX.groupComplete();
      shakeSmall();
    } else {
      SoundFX.tally();
    }

    // A genuine new record (not just "day 1") — celebrated before achievements
    // in priority, but only when there was a real previous best to beat.
    const isNewRecord = prevBestRef.current > 0 && newStats.bestStreak > prevBestRef.current;
    prevBestRef.current = newStats.bestStreak;

    if (milestone || isNewRecord) {
      skipNextQuoteEffect.current = true;
      setQuote(pickQuote({
        envState,
        currentStreak: newStats.currentStreak,
        isNewRecord,
        justMilestone: !!milestone,
      }));
    }

    if (milestone) {
      clearTimeout(achievementTimeoutRef.current);
      const delay = justCompletedGroup ? 350 : 150;
      setTimeout(() => {
        setAchievement(milestone);
        SoundFX.milestone();
        shakeBig();
        achievementTimeoutRef.current = setTimeout(() => setAchievement(null), 3600);
      }, delay);
    }
  }

  function handleMarkToday() {
    const rect = markBtnRef.current.getBoundingClientRect();
    const today = todayStr();
    const result = addCompletion(today);
    celebrate(result, rect, today);
  }

  function handleUndoToday() {
    SoundFX.click();
    setConfirm({
      title: 'UNDO TALLY',
      body: 'Remove today’s tally mark from the wall?',
      onYes: () => { removeCompletion(todayStr()); SoundFX.undo(); },
    });
  }

  function handleToggleDay(dateStr, cellEl) {
    if (activeRoutine.completed.includes(dateStr)) {
      removeCompletion(dateStr);
      SoundFX.undo();
    } else {
      const rect = cellEl.getBoundingClientRect();
      const result = addCompletion(dateStr);
      celebrate(result, rect, dateStr);
    }
  }

  function handleSelectRoutine(id) { SoundFX.click(); selectRoutine(id); }

  function handleDeleteRoutine(routine) {
    SoundFX.click();
    setConfirm({
      title: 'DELETE ROUTINE',
      body: `Permanently delete "${routine.name}" and all its tallies?`,
      onYes: () => { deleteRoutine(routine.id); SoundFX.undo(); },
    });
  }

  function handleCreateRoutine(name, startDate) {
    addRoutine(name, startDate);
    setAddRoutineOpen(false);
    setCalendarCursor(startOfMonth());
    SoundFX.tally();
  }

  function handleOpenGroup(dates) { SoundFX.open(); setGroupDates(dates); }
  function handleCloseGroup() { SoundFX.close(); setGroupDates(null); }

  function handleConfirmYes() { if (confirm) confirm.onYes(); setConfirm(null); }
  function handleConfirmNo() { SoundFX.close(); setConfirm(null); }

  function handlePrevMonth() {
    setCalendarCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d; });
    SoundFX.click();
  }
  function handleNextMonth() {
    setCalendarCursor((c) => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d; });
    SoundFX.click();
  }

  function handleToggleMute() {
    const next = !SoundFX.isMuted();
    SoundFX.setMuted(next);
    setMuted(next);
    if (!next) SoundFX.click();
  }

  function scrollToLog() {
    document.getElementById('cell-log')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
  }

  return (
    <div className="app" data-env={envState}>
      {/* GAME VIEW — fixed, full-viewport room with the HUD around it */}
      <GameView
        envState={envState}
        shake={appControls}
        drawer={drawer}
        setDrawer={setDrawer}
        onOpenCalendar={scrollToLog}
        topBar={({ collapsed }) => (
          <TopBar
            muted={muted}
            onToggleMute={handleToggleMute}
            onAddRoutine={() => { SoundFX.open(); setAddRoutineOpen(true); }}
            collapsed={collapsed}
          />
        )}
        title={<span className="scene-routine-name">{activeRoutine.name}</span>}
        wall={(
          <TallyWall
            stats={stats}
            jailControls={jailControls}
            freshDate={freshDate}
            onOpenGroup={handleOpenGroup}
            onTooltip={showTooltip}
            onMoveTooltip={moveTooltip}
            onHideTooltip={hideTooltip}
          />
        )}
        left={({ closeDrawer }) => (
          <Sidebar
            routines={routines}
            activeRoutine={activeRoutine}
            onSelect={(id) => { handleSelectRoutine(id); closeDrawer(); }}
            onDelete={handleDeleteRoutine}
          />
        )}
        right={() => (
          <>
            <StatsPanel stats={stats} />
            <Achievements routine={activeRoutine} stats={stats} />
          </>
        )}
        bottom={(
          <>
            <div className="hud-action">
              <DayNumber stats={stats} />
              <ActionButtons
                doneToday={doneToday}
                onMarkToday={handleMarkToday}
                onUndo={handleUndoToday}
                markBtnRef={markBtnRef}
              />
            </div>
            <QuotePlaque quote={quote} onReroll={handleRerollQuote} />
            <button type="button" className="scroll-cue" onClick={scrollToLog}>CELL LOG v</button>
          </>
        )}
      />

      {/* DATA VIEW — scrolls up over the fixed game view */}
      <div className="game-spacer" aria-hidden="true" />
      <main className="data-view" id="cell-log">
        <CellLog
          routine={activeRoutine}
          stats={stats}
          cursor={calendarCursor}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onToggleDay={handleToggleDay}
          onTooltip={showTooltip}
          onMoveTooltip={moveTooltip}
          onHideTooltip={hideTooltip}
        />
      </main>

      <Tooltip tooltip={tooltip} />
      <GroupPopover dates={groupDates} onClose={handleCloseGroup} />
      <ConfirmModal confirm={confirm} onYes={handleConfirmYes} onNo={handleConfirmNo} />
      <AddRoutineModal
        open={addRoutineOpen}
        onClose={() => { SoundFX.close(); setAddRoutineOpen(false); }}
        onCreate={handleCreateRoutine}
      />
      <AchievementPopup achievement={achievement} />
      <ParticleLayer particles={particles} onDone={removeParticle} />
      <DevEnvSwitcher envState={envState} />
    </div>
  );
}
