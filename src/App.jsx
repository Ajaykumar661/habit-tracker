import { useEffect, useRef, useState, useMemo } from 'react';
import { useAnimation, useReducedMotion } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import TopBar from './components/TopBar';
import QuestBoard from './components/QuestBoard';
import DayNumber from './components/DayNumber';
import TallyWall from './components/TallyWall';
import ActionButtons from './components/ActionButtons';
import CellLog from './components/CellLog';
import StatsPanel from './components/StatsPanel';
import Achievements from './components/Achievements';
import KingdomReport from './components/KingdomReport';
import RallyStrip from './components/RallyStrip';
import { getRecovery } from './domain/recovery';
import { musicFor } from './data/themes';
import { voiceFor } from './data/voice';
import { VoiceContext } from './hooks/useVoice';
import Tooltip from './components/Tooltip';
import ConfirmModal from './components/ConfirmModal';
import AddRoutineModal from './components/AddRoutineModal';
import StreakLostModal from './components/StreakLostModal';
import DayDetail from './components/DayDetail';
import SettingsSheet from './components/SettingsSheet';
import GuideSheet from './components/GuideSheet';
import GroupPopover from './components/GroupPopover';
import AchievementPopup from './components/AchievementPopup';
import ParticleLayer from './components/ParticleLayer';
import QuotePlaque from './components/QuotePlaque';
import DevEnvSwitcher from './components/DevEnvSwitcher';
import GameView from './components/GameView';
import LevelPlaque from './components/LevelPlaque';
import { useTallyWallState } from './hooks/useTallyWallState';
import { useEnvironmentState } from './hooks/useEnvironmentState';
import { SoundFX } from './lib/sound';
import { Music } from './lib/music';
import { pickQuote } from './data/quotes';
import { isScheduledOn } from './domain/schedule';
import { isComplete } from './domain/completion';

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
    acknowledgeStreakLoss, acknowledgeShield, today, progression, addProgress,
    board, advanceQuest, habits, completions, notes, setNote, setBreakReason,
    settings, setSetting, editRoutine, restoreRoutine, purgeRoutine, archived,
  } = useTallyWallState();

  const envState = useEnvironmentState();

  const [calendarCursor, setCalendarCursor] = useState(startOfMonth);
  const [tooltip, setTooltip] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [addRoutineOpen, setAddRoutineOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [groupDates, setGroupDates] = useState(null);
  const [openDay, setOpenDay] = useState(null);
  const [drawer, setDrawer] = useState(null); // 'routines' | 'record' | null — the mobile HUD drawer
  const [achievement, setAchievement] = useState(null);
  const [particles, setParticles] = useState([]);
  const [muted, setMuted] = useState(SoundFX.isMuted());
  const [freshDate, setFreshDate] = useState(null);
  const [shieldNotice, setShieldNotice] = useState(null);
  // The active world's words: labels, ranks, quotes. Everything below the
  // provider reads them through useVoice().
  const voice = voiceFor(settings?.theme);
  const [quote, setQuote] = useState(() => pickQuote({ envState, currentStreak: stats.currentStreak }, voice.quotes));

  const markBtnRef = useRef(null);
  const achievementTimeoutRef = useRef(null);
  const freshTimeoutRef = useRef(null);
  const skipNextQuoteEffect = useRef(false);
  const prevBestRef = useRef(stats.bestStreak);
  const jailControls = useAnimation();
  const appControls = useAnimation();
  const reducedMotion = useReducedMotion();

  const doneToday = activeRoutine.completed.includes(today);
  const todayRecord = activeRoutine.records?.[today];

  // A lapsed run is worth naming, but only once and only if it was long
  // enough to feel like something. Below this it's just noise.
  const MOURN_MIN_DAYS = 3;
  const { brokenStreak } = stats;
  const showStreakLost = !!brokenStreak
    && brokenStreak.days >= MOURN_MIN_DAYS
    && activeRoutine.mournedStreakEnd !== brokenStreak.endedOn;

  // A streak worth keeping, still unmarked, and the day is nearly gone.
  // Recomputed whenever the clock is re-checked (envState ticks each minute),
  // so it appears on its own rather than only after an interaction.
  // Nothing is at risk on a day the habit was never due — saying otherwise
  // would nag the user into "rescuing" a streak that was never in danger.
  const atRisk = !doneToday && stats.currentStreak > 0
    && isScheduledOn(activeRoutine, today)
    && new Date().getHours() >= 19 && envState !== null;

  // First run: show the guide once. It is opened from an effect rather than
  // from initial state so that a restored backup, which reloads the page
  // with settings already written, does not reopen it.
  useEffect(() => {
    if (settings && settings.seenGuide === false) setGuideOpen(true);
  }, [settings]);

  function closeGuide() {
    SoundFX.close();
    setGuideOpen(false);
    if (settings?.seenGuide === false) setSetting('seenGuide', true);
  }

  // The rally, in the days after a break. Derived from the same stats the
  // wall already computed, so it costs nothing extra.
  const recovery = useMemo(
    () => getRecovery(activeRoutine, today, stats),
    [activeRoutine, today, stats],
  );

  // Ambient quote refresh: fires on load, on time-of-day change, and on any
  // streak change that celebrate() didn't already give a special quote to.
  useEffect(() => {
    if (skipNextQuoteEffect.current) { skipNextQuoteEffect.current = false; return; }
    setQuote((prev) => pickQuote({
      envState,
      currentStreak: stats.currentStreak,
      missedYesterday: stats.currentStreak === 0 && stats.totalCompleted > 0,
      excludeText: prev,
    }, voice.quotes));
    // A new world gets a line in its own voice straight away.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envState, stats.currentStreak, voice]);

  // Background music follows the time of day. It can only actually start
  // from a user gesture (every browser blocks audio before that), so the
  // first interaction arms it and whatever is `wanted` begins then.
  const theme = settings?.theme;
  useEffect(() => { Music.playFor(musicFor(envState, theme)); }, [envState, theme]);

  // The interface skin keys off <html data-theme>, so it reaches modals,
  // tooltips and the log below the room as well as the room itself.
  useEffect(() => {
    document.documentElement.dataset.theme = theme || 'medieval';
  }, [theme]);

  useEffect(() => {
    // Not `once`: a browser may refuse the first gesture, and giving up
    // after one attempt leaves the whole session silent with no way back.
    // Music.arm() is idempotent, so we keep offering gestures until it
    // reports that sound is actually coming out, then stop listening.
    const arm = () => {
      Music.arm();
      SoundFX.resume();
      if (Music.isArmed()) detach();
    };
    const opts = { passive: true };
    const events = ['pointerdown', 'touchend', 'keydown', 'click'];
    const detach = () => events.forEach((e) => window.removeEventListener(e, arm, opts));
    events.forEach((e) => window.addEventListener(e, arm, opts));

    const onVis = () => Music.setSuspended(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      detach();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // A spent shield is a historical fact, not a live event — it is derived
  // from the record every time. To announce it exactly once, the habit
  // remembers which spend it has already shown. The notice is a line of
  // text, deliberately not a modal: the streak survived, which needs
  // acknowledging, not celebrating.
  const lastShield = stats.shields?.spent?.length
    ? stats.shields.spent[stats.shields.spent.length - 1]
    : null;

  useEffect(() => {
    if (!lastShield || activeRoutine.acknowledgedShield === lastShield.date) return undefined;
    setShieldNotice(lastShield);
    acknowledgeShield(lastShield.date);
    SoundFX.open();
    const t = setTimeout(() => setShieldNotice(null), 7000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastShield?.date, activeRoutine.id]);

  // Android hardware back button: close whatever's open (native only — a
  // browser has no such button to listen for). Registering a listener hands
  // Capacitor's own back/exit behavior to us entirely, so the last case must
  // exit the app itself or the button would go dead with nothing left open.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return undefined;
    const sub = CapApp.addListener('backButton', () => {
      if (showStreakLost) { acknowledgeStreakLoss(brokenStreak.endedOn); return; }
      if (achievement) { setAchievement(null); return; }
      if (confirm) { handleConfirmNo(); return; }
      if (groupDates) { handleCloseGroup(); return; }
      if (openDay) { SoundFX.close(); setOpenDay(null); return; }
      // Without the guide and the edit dialog here, Back on either one quit
      // the app instead of closing it.
      if (guideOpen) { closeGuide(); return; }
      if (settingsOpen) { SoundFX.close(); setSettingsOpen(false); return; }
      if (addRoutineOpen) { SoundFX.close(); setAddRoutineOpen(false); return; }
      if (editingRoutine) { SoundFX.close(); setEditingRoutine(null); return; }
      if (drawer) { setDrawer(null); return; }
      CapApp.exitApp();
    });
    return () => { sub.then((h) => h.remove()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [achievement, confirm, groupDates, addRoutineOpen, settingsOpen, openDay, drawer, showStreakLost,
    guideOpen, editingRoutine]);

  function handleRerollQuote() {
    setQuote((prev) => pickQuote({ envState, currentStreak: stats.currentStreak, excludeText: prev }, voice.quotes));
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
      }, voice.quotes));
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

  function handleAddProgress(delta) {
    const rect = markBtnRef.current?.getBoundingClientRect();
    const result = addProgress(today, delta);
    if (result && rect) celebrate(result, rect, today);
    else if (delta > 0) SoundFX.click();
  }

  function handleAdvanceQuest(habitId) {
    const rect = markBtnRef.current?.getBoundingClientRect();
    const result = advanceQuest(habitId, today);
    if (result) celebrate(result, rect || { left: 0, top: 0, width: 0, height: 0 }, today);
    else SoundFX.click();
  }

  function handleMarkToday() {
    const rect = markBtnRef.current.getBoundingClientRect();
    const result = addCompletion(today);
    celebrate(result, rect, today);
  }

  function handleUndoToday() {
    SoundFX.click();
    setConfirm({
      title: voice.confirm.undoTitle,
      body: voice.confirm.undoBody,
      onYes: () => { removeCompletion(today); SoundFX.undo(); },
    });
  }

  function handleOpenDay(dateStr) {
    SoundFX.open();
    setOpenDay(dateStr);
  }

  /**
   * Toggle one habit on an arbitrary day, from inside the chronicle.
   *
   * Whole-day toggle rather than the quest board's single step: filling in
   * the past means "I did this and forgot to log it", so tapping six times
   * to retro-fill a counter would be busywork.
   */
  function handleToggleHabitOn(habitId) {
    if (!openDay) return;
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (isComplete(habit, completions[habitId]?.[openDay])) {
      removeCompletion(openDay, habitId);
      SoundFX.undo();
      return;
    }
    const result = addCompletion(openDay, {}, habitId);
    if (result && openDay === today) celebrate(result, { left: 0, top: 0, width: 0, height: 0 }, openDay);
    else SoundFX.tally();
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
      title: voice.confirm.retireTitle,
      // No longer a destructive act, and the wording says so: the tallies
      // stay, and settings can bring the quest back.
      body: voice.confirm.retireBody(routine.name),
      onYes: () => { deleteRoutine(routine.id); SoundFX.undo(); },
    });
  }

  function handleEditRoutine(routine) {
    SoundFX.open();
    setEditingRoutine(routine);
  }

  function handleSaveRoutine(id, changes) {
    editRoutine(id, changes);
    setEditingRoutine(null);
    SoundFX.tally();
  }

  function handlePurgeRoutine(routine) {
    setConfirm({
      title: 'DELETE FOREVER',
      body: voice.confirm.purgeBody(routine.name),
      onYes: () => { purgeRoutine(routine.id); SoundFX.undo(); },
    });
  }

  function handleCreateRoutine(name, startDate, options) {
    addRoutine(name, startDate, options);
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
    <VoiceContext.Provider value={voice}>
    <div className="app" data-env={envState}>
      {/* GAME VIEW — fixed, full-viewport room with the HUD around it */}
      <GameView
        envState={envState}
        theme={theme}
        streak={stats.currentStreak}
        shake={appControls}
        drawer={drawer}
        setDrawer={setDrawer}
        onOpenCalendar={scrollToLog}
        topBar={({ collapsed }) => (
          <TopBar
            onAddRoutine={() => { SoundFX.open(); setAddRoutineOpen(true); }}
            onOpenSettings={() => { SoundFX.open(); setSettingsOpen(true); }}
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
          <QuestBoard
            board={board}
            activeId={activeRoutine.id}
            onAdvance={handleAdvanceQuest}
            onSelect={(id) => { handleSelectRoutine(id); closeDrawer(); }}
            onEdit={handleEditRoutine}
            onDelete={handleDeleteRoutine}
          />
        )}
        right={() => (
          <>
            <LevelPlaque progression={progression} />
            <StatsPanel stats={stats} progression={progression} />
            <Achievements
              routine={activeRoutine}
              habits={habits}
              completions={completions}
              today={today}
            />
            <KingdomReport habits={habits} completions={completions} today={today} />
          </>
        )}
        bottom={(
          <>
            <div className="hud-action">
              {shieldNotice && (
                <p className="shield-notice" role="status">
                  {voice.notice.shield}
                </p>
              )}
              {atRisk && (
                <p className="streak-risk" role="status">
                  {voice.notice.risk(stats.currentStreak)}
                </p>
              )}
              <RallyStrip recovery={recovery} />
              <div className="action-row">
                <DayNumber stats={stats} doneToday={doneToday} />
                <ActionButtons
                  routine={activeRoutine}
                  record={todayRecord}
                  doneToday={doneToday}
                  onMarkToday={handleMarkToday}
                  onAddProgress={handleAddProgress}
                  onUndo={handleUndoToday}
                  markBtnRef={markBtnRef}
                />
              </div>
            </div>
            <QuotePlaque quote={quote} onReroll={handleRerollQuote} />
            <button type="button" className="scroll-cue" onClick={scrollToLog}>{voice.log.cue}</button>
          </>
        )}
      />

      {/* DATA VIEW — scrolls up over the fixed game view */}
      <div className="game-spacer" aria-hidden="true" />
      <main className="data-view" id="cell-log">
        <CellLog
          routine={activeRoutine}
          stats={stats}
          today={today}
          shieldedDates={stats.shields?.shieldedDates}
          cursor={calendarCursor}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
          onOpenDay={handleOpenDay}
          notes={notes}
          onSetBreakReason={setBreakReason}
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
        habits={habits}
        today={today}
      />
      {/* The same form, prefilled, for changing a quest that already exists. */}
      <AddRoutineModal
        open={!!editingRoutine}
        editing={editingRoutine}
        onClose={() => { SoundFX.close(); setEditingRoutine(null); }}
        onSave={handleSaveRoutine}
        habits={habits}
        today={today}
      />
      <GuideSheet open={guideOpen} onClose={closeGuide} />
      <SettingsSheet
        open={settingsOpen}
        onClose={() => { SoundFX.close(); setSettingsOpen(false); }}
        muted={muted}
        onToggleMute={handleToggleMute}
        settings={settings}
        onSetSetting={setSetting}
        onOpenGuide={() => { SoundFX.open(); setSettingsOpen(false); setGuideOpen(true); }}
        habits={habits}
        archived={archived}
        onRestore={(r) => { restoreRoutine(r.id); SoundFX.tally(); }}
        onPurge={handlePurgeRoutine}
      />
      {showStreakLost && (
        <StreakLostModal
          broken={brokenStreak}
          bestStreak={stats.bestStreak}
          onDismiss={() => { SoundFX.close(); acknowledgeStreakLoss(brokenStreak.endedOn); }}
        />
      )}
      <DayDetail
        open={!!openDay}
        date={openDay}
        habits={habits}
        completions={completions}
        notes={notes}
        today={today}
        onClose={() => { SoundFX.close(); setOpenDay(null); }}
        onToggleHabit={handleToggleHabitOn}
        onSaveNote={setNote}
      />
      <AchievementPopup achievement={achievement} />
      <ParticleLayer particles={particles} onDone={removeParticle} />
      <DevEnvSwitcher envState={envState} />
    </div>
    </VoiceContext.Provider>
  );
}
