// ============================================================
// VOICE
// Every word the app says that belongs to a world rather than to the app:
// what a habit is called, what the record is called, the ranks, the quotes,
// the guide. Each theme has one voice with exactly the same keys (a test
// checks this), and components read it through useVoice() -- so a new theme
// is a new entry here, not a hunt through thirty components.
//
// Plain UI words that mean the same in any world (CANCEL, VOLUME, EXPORT,
// EASY/NORMAL/HARD) are not here; they stay where they are used.
// ============================================================

import { TITLES } from '../domain/xp';
import { QUEST_WORDS } from '../domain/quests';
import { RALLY_WORDS } from '../domain/recovery';
import { REPORT_WORDS } from '../domain/analytics';
import { BREAK_REASONS } from '../domain/history';
import { MEDIEVAL_QUOTES } from './quotes';
import { NEON_QUOTE_SET } from './quotes-neon';
import { GUIDE_PAGES } from './guide';
import { NEON_GUIDE_PAGES } from './guide-neon';

const reasons = (labels) => Object.fromEntries(BREAK_REASONS.map((r) => [r.id, labels[r.id] || r.label]));

// ---- Medieval Keep ----------------------------------------------------------
// The words the app has always used, gathered here unchanged.
const medieval = {
  newHabit: '+ NEW ROUTINE',
  tabs: { routines: 'Routines', calendar: 'Calendar', record: 'Records' },

  quest: {
    board: 'TODAY’S QUEST',
    later: 'NOT DUE TODAY',
    done: 'DONE',
    notDone: 'NOT DONE',
    edit: 'Edit quest',
    retire: 'Retire quest',
    summary: QUEST_WORDS,
  },

  stats: {
    title: 'RECORD',
    current: 'CURRENT STREAK',
    best: 'LONGEST SENTENCE',
    total: 'TOTAL TALLIES',
    completion: 'COMPLETION',
    missed: 'MISSED DAYS',
    tracked: 'DAYS TRACKED',
    shields: 'STREAK SHIELDS',
    perfect: 'PERFECT DAYS',
  },

  level: { titles: TITLES, perfect: 'PERFECT', earned: 'XP EARNED' },

  achievements: {
    title: 'ACHIEVEMENTS',
    secret: 'A SECRET DEED',
    earned: 'EARNED',
    unlocked: 'ACHIEVEMENT UNLOCKED',
    // names by catalogue id; empty means "use the catalogue's own"
    names: {},
  },

  report: {
    title: 'KINGDOM REPORT',
    kept: 'KEPT',
    perfect: 'PERFECT DAYS',
    xp: 'XP EARNED',
    versus: 'AGAINST LAST WEEK',
    needWeek: 'THE HERALD NEEDS A FULL WEEK BEFORE SPEAKING.',
    noPattern: 'NO CLEAR PATTERN YET. KEEP THE RECORD AND IT WILL SHOW.',
    words: REPORT_WORDS,
  },

  action: {
    mark: '+ MARK TODAY COMPLETE',
    markShort: '+ COMPLETE',
    done: 'TODAY COMPLETE',
    doneShort: 'COMPLETE',
    undo: 'UNDO TALLY',
  },

  wall: {
    emptyTitle: 'YOUR WALL IS EMPTY',
    emptySub: 'FIRST TALLY AWAITS',
    one: 'TALLY',
    many: 'TALLIES',
    marked: 'TALLY MARKED',
  },

  notice: {
    shield: 'A SHIELD PROTECTED THE STREAK',
    shieldSpent: 'SHIELD SPENT',
    risk: (n) => `${n}-DAY STREAK ENDS AT MIDNIGHT`,
  },

  rally: { label: 'THE RALLY', words: RALLY_WORDS },

  lost: {
    title: 'THE STREAK IS BROKEN',
    ended: 'ENDED',
    best: (n) => `YOUR LONGEST STANDS AT ${n} ${n === 1 ? 'DAY' : 'DAYS'}`,
    cta: (n) => `RETURN FOR ${n} DAYS TO WIN THE RALLY`,
    button: 'BEGIN ANEW',
  },

  confirm: {
    undoTitle: 'UNDO TALLY',
    undoBody: 'Remove today\u2019s tally mark from the wall?',
    retireTitle: 'RETIRE QUEST',
    retireBody: (name) => `Retire "${name}"? Its tallies are kept, and you can restore it from settings.`,
    purgeBody: (name) => `Erase "${name}" and every tally it holds? This cannot be undone.`,
  },

  editor: {
    create: 'NEW QUEST',
    edit: 'EDIT QUEST',
    name: 'QUEST NAME',
    duplicate: 'A QUEST BY THAT NAME ALREADY EXISTS',
    fallbackName: 'MY ROUTINE',
  },

  settings: {
    guide: 'THE GUIDE',
    dayTurns: 'WHEN THE DAY TURNS',
    midnight: 'THE DAY TURNS AT MIDNIGHT.',
    before: (h) => `A TALLY BEFORE ${h}AM COUNTS FOR THE DAY BEFORE.`,
    record: 'YOUR RECORD',
    daysOf: 'DAYS OF RECORD',
    retired: 'RETIRED QUESTS',
    retiredHelp: 'Their tallies are kept. Restore one to put it back on the board.',
    saved: (t, r) => `SAVED ${t} TALLIES FROM ${r} ROUTINE${r === 1 ? '' : 'S'}`,
  },

  day: {
    chronicle: 'THE CHRONICLE',
    perfect: 'A PERFECT DAY',
    pending: 'OUTSTANDING',
    nothing: 'NOTHING WAS TRACKED ON THIS DAY.',
    note: 'TODAY’S CHRONICLE',
    hasNote: 'HAS A NOTE',
  },

  history: {
    title: 'STREAK HISTORY',
    broken: 'BROKEN',
    ask: 'WHAT HAPPENED?',
    reason: 'REASON',
    summary: (n, list) => `${n} RUN(S) HAVE A RECORDED REASON: ${list}`,
    reasons: reasons({}),
  },

  log: {
    cue: 'CELL LOG v',
    title: 'CELL LOG',
    recent: 'RECENT TALLIES',
    emptyRun: 'NO TALLIES IN CURRENT SENTENCE YET.',
  },

  guide: { title: 'THE WARDEN’S GUIDE', pages: GUIDE_PAGES },
  quotes: MEDIEVAL_QUOTES,
};

// ---- Neon City --------------------------------------------------------------
const neon = {
  newHabit: '+ NEW MISSION',
  tabs: { routines: 'Missions', calendar: 'Logbook', record: 'Stats' },

  quest: {
    board: 'TODAY’S MISSIONS',
    later: 'OFF SHIFT TODAY',
    done: 'DONE',
    notDone: 'PENDING',
    edit: 'Edit mission',
    retire: 'Archive mission',
    summary: {
      none: 'NO MISSIONS TODAY',
      allDone: 'ALL CLEAR',
      progress: (done, total) => `${done} / ${total} COMPLETE`,
    },
  },

  stats: {
    title: 'STATS',
    current: 'CURRENT STREAK',
    best: 'LONGEST UPTIME',
    total: 'TOTAL LOGS',
    completion: 'COMPLETION',
    missed: 'MISSED DAYS',
    tracked: 'DAYS ONLINE',
    shields: 'FIREWALLS',
    perfect: 'FLAWLESS DAYS',
  },

  level: {
    titles: [
      { level: 1, title: 'ROOKIE' },
      { level: 5, title: 'RUNNER' },
      { level: 10, title: 'FIXER' },
      { level: 20, title: 'NETRUNNER' },
      { level: 30, title: 'GHOST' },
      { level: 50, title: 'OPERATOR' },
      { level: 75, title: 'ARCHITECT' },
      { level: 100, title: 'MAINFRAME' },
    ],
    perfect: 'FLAWLESS',
    earned: 'XP GAINED',
  },

  achievements: {
    title: 'UNLOCKS',
    secret: 'ENCRYPTED',
    earned: 'UNLOCKED',
    unlocked: 'UNLOCK ACQUIRED',
    names: {
      'first-blood': { title: 'FIRST BOOT', desc: 'Log your first mission' },
      century: { title: 'TRIPLE DIGITS', desc: 'One hundred missions logged' },
      unbroken: { title: '30-DAY UPTIME', desc: 'Hold a streak for thirty days' },
      'perfect-week': { title: 'CLEAN WEEK', desc: 'Seven flawless days in a row' },
      'the-scholar': { title: 'DEEP DIVE', desc: 'Fifty hours logged on timed missions' },
      'night-owl': { title: 'NIGHT SHIFT', desc: 'Finish twenty-five missions after 10pm' },
      'dawn-rider': { title: 'EARLY ACCESS', desc: 'Finish twenty-five missions before 9am' },
      comeback: { title: 'REBOOTED', desc: 'Log three days back after going offline' },
      warden: { title: 'FIREWALL', desc: 'Let a firewall save a streak' },
      'many-paths': { title: 'MULTITHREAD', desc: 'Run four missions at once' },
      'streak-7': { title: 'WEEK ONLINE' },
      'streak-14': { title: 'LOCKED ON' },
      'streak-30': { title: 'FULL CYCLE' },
      'streak-50': { title: 'HARDWIRED' },
      'streak-100': { title: 'ETERNAL LOOP' },
    },
  },

  report: {
    title: 'CITY REPORT',
    kept: 'LOGGED',
    perfect: 'FLAWLESS DAYS',
    xp: 'XP GAINED',
    versus: 'VS LAST WEEK',
    needWeek: 'THE FEED NEEDS A FULL WEEK OF DATA.',
    noPattern: 'NO CLEAR SIGNAL YET. KEEP LOGGING AND IT WILL RESOLVE.',
    words: {
      bestDay: (day, p) => `${day} IS YOUR PEAK DAY — ${p}% LOGGED.`,
      worstDay: (day, p) => `${day} DRAWS THE MOST POWER — ${p}% LOGGED.`,
      weekendBetter: (we, wk) => `WEEKENDS RUN HOT — ${we}% AGAINST ${wk}% IN THE WEEK.`,
      weekBetter: (wk, we) => `THE WEEK RUNS STEADIER THAN THE WEEKEND — ${wk}% AGAINST ${we}%.`,
      gaining: (now, before) => `SIGNAL RISING — ${now}% THIS WEEK, UP FROM ${before}%.`,
      harder: (now, before) => `THIS WEEK RAN HEAVY — ${now}%, DOWN FROM ${before}%.`,
      steadiest: (name, p) => `${name} IS YOUR MOST STABLE PROCESS — ${p}% LOGGED.`,
      hardest: (name) => `${name} HAS NEEDED THE MOST UPTIME.`,
      notWritten: 'NO DATA FOR THIS WEEK YET.',
      flawless: 'A FLAWLESS WEEK. ZERO PACKET LOSS.',
      strong: 'A STRONG WEEK. ALL SYSTEMS GREEN.',
      held: 'THE WEEK HELD, IF NOT EASILY.',
      hard: 'A HEAVY WEEK. EVERY LOG STILL COUNTS.',
      quiet: 'A QUIET WEEK. THE WALL IS STILL ONLINE.',
    },
  },

  action: {
    mark: '+ LOG TODAY',
    markShort: '+ LOG',
    done: 'LOGGED TODAY',
    doneShort: 'LOGGED',
    undo: 'UNDO LOG',
  },

  wall: {
    emptyTitle: 'THE WALL IS BLANK',
    emptySub: 'AWAITING FIRST LOG',
    one: 'LOG',
    many: 'LOGS',
    marked: 'LOGGED',
  },

  notice: {
    shield: 'A FIREWALL HELD THE STREAK',
    shieldSpent: 'FIREWALL DEPLOYED',
    risk: (n) => `${n}-DAY STREAK TIMES OUT AT MIDNIGHT`,
  },

  rally: {
    label: 'REBOOT',
    words: {
      won: 'REBOOT COMPLETE. BACK ONLINE.',
      startToday: 'ONE LOG TODAY STARTS THE REBOOT.',
      startLater: 'THE REBOOT STARTS ON YOUR NEXT DUE DAY.',
      oneMore: 'ONE MORE DAY AND THE REBOOT IS DONE.',
      more: (n) => `${n} MORE DAYS TO FINISH THE REBOOT.`,
    },
  },

  lost: {
    title: 'CONNECTION LOST',
    ended: 'DROPPED',
    best: (n) => `YOUR BEST UPTIME HOLDS AT ${n} ${n === 1 ? 'DAY' : 'DAYS'}`,
    cta: (n) => `LOG ${n} DAYS TO COMPLETE THE REBOOT`,
    button: 'RECONNECT',
  },

  confirm: {
    undoTitle: 'UNDO LOG',
    undoBody: 'Remove today\u2019s log from the wall?',
    retireTitle: 'ARCHIVE MISSION',
    retireBody: (name) => `Archive "${name}"? Its logs are kept, and you can restore it from settings.`,
    purgeBody: (name) => `Erase "${name}" and every log it holds? This cannot be undone.`,
  },

  editor: {
    create: 'NEW MISSION',
    edit: 'EDIT MISSION',
    name: 'MISSION NAME',
    duplicate: 'A MISSION BY THAT NAME ALREADY EXISTS',
    fallbackName: 'MY MISSION',
  },

  settings: {
    guide: 'THE MANUAL',
    dayTurns: 'DAILY RESET',
    midnight: 'THE DAY RESETS AT MIDNIGHT.',
    before: (h) => `A LOG BEFORE ${h}AM COUNTS FOR THE DAY BEFORE.`,
    record: 'YOUR DATA',
    daysOf: 'DAYS OF DATA',
    retired: 'ARCHIVED MISSIONS',
    retiredHelp: 'Their logs are kept. Restore one to put it back in rotation.',
    saved: (t, r) => `SAVED ${t} LOGS FROM ${r} MISSION${r === 1 ? '' : 'S'}`,
  },

  day: {
    chronicle: 'THE LOGBOOK',
    perfect: 'A FLAWLESS DAY',
    pending: 'PENDING',
    nothing: 'NO DATA FOR THIS DAY.',
    note: 'DAY LOG',
    hasNote: 'HAS A NOTE',
  },

  history: {
    title: 'RUN HISTORY',
    broken: 'DROPPED',
    ask: 'CAUSE?',
    reason: 'CAUSE',
    summary: (n, list) => `${n} RUN(S) HAVE A LOGGED CAUSE: ${list}`,
    reasons: reasons({
      busy: 'OVERLOADED', travel: 'IN TRANSIT', intentional: 'PLANNED DOWNTIME', other: 'OTHER',
    }),
  },

  log: {
    cue: 'DATA LOG v',
    title: 'DATA LOG',
    recent: 'RECENT LOGS',
    emptyRun: 'NO LOGS IN THIS RUN YET.',
  },

  guide: { title: 'THE OPERATOR’S MANUAL', pages: NEON_GUIDE_PAGES },
  quotes: NEON_QUOTE_SET,
};

export const VOICES = { medieval, neon };

export function voiceFor(themeId) {
  return VOICES[themeId] || VOICES.medieval;
}

/** An achievement with this voice's name for it, if it has one. */
export function voicedAchievement(voice, a) {
  const named = voice.achievements.names[a.id];
  return named ? { ...a, ...named } : a;
}
