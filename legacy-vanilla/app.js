/* ============================================================
   TALLY WALL — app logic
   ============================================================ */

const STORAGE_KEY = 'tally-wall-state-v1';
const MUTE_KEY = 'tally-wall-muted';

/* ---------------------------------------------------------- */
/* SoundFX — tiny synthesized 8-bit blips via Web Audio API   */
/* (no audio files needed, fits the chiptune aesthetic)        */
/* ---------------------------------------------------------- */
const SoundFX = (() => {
  let ctx = null;
  let muted = localStorage.getItem(MUTE_KEY) === '1';

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, duration, opts = {}) {
    if (muted) return;
    try {
      const { type = 'square', vol = 0.15, delay = 0, slideTo = null } = opts;
      const c = getCtx();
      const t0 = c.currentTime + delay;
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + duration);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
      osc.connect(gain).connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + duration + 0.02);
    } catch (e) { /* audio unavailable — fail silently */ }
  }

  return {
    isMuted: () => muted,
    setMuted(v) { muted = v; localStorage.setItem(MUTE_KEY, v ? '1' : '0'); },
    click() { tone(220, 0.05, { type: 'square', vol: 0.09 }); },
    open() { tone(520, 0.05, { type: 'square', vol: 0.08 }); },
    close() { tone(260, 0.05, { type: 'square', vol: 0.08 }); },
    tally() {
      tone(440, 0.07, { type: 'square', vol: 0.15 });
      tone(660, 0.09, { type: 'square', vol: 0.12, delay: 0.06 });
    },
    groupComplete() {
      [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.1, { type: 'square', vol: 0.14, delay: i * 0.07 }));
    },
    milestone() {
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, { type: 'triangle', vol: 0.19, delay: i * 0.09 }));
    },
    undo() { tone(320, 0.14, { type: 'sawtooth', vol: 0.12, slideTo: 110 }); },
    denied() { tone(120, 0.16, { type: 'square', vol: 0.1 }); },
  };
})();

const ACHIEVEMENTS = [
  { days: 7, code: 'FIRST WEEK', icon: 'star' },
  { days: 14, code: 'LOCKED IN', icon: 'key' },
  { days: 30, code: 'MONTH COMPLETE', icon: 'calendar' },
  { days: 50, code: 'IRON WILL', icon: 'shield' },
  { days: 100, code: 'LEGEND', icon: 'crown' },
];

const ICON_BITMAPS = {
  star: [
    '00011000',
    '00011000',
    '01111110',
    '11111111',
    '11111111',
    '01111110',
    '00100100',
    '01000010',
  ],
  key: [
    '00111100',
    '01000010',
    '01000010',
    '00111100',
    '00011000',
    '00011000',
    '01111110',
    '00000000',
  ],
  calendar: [
    '11111111',
    '10000001',
    '10111101',
    '10101101',
    '10111101',
    '10000001',
    '11111111',
    '00000000',
  ],
  shield: [
    '01111110',
    '11111111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00011000',
    '00011000',
  ],
  crown: [
    '10000001',
    '11000011',
    '11100111',
    '11111111',
    '11111111',
    '01111110',
    '00111100',
    '00000000',
  ],
};

/* ---------------------------------------------------------- */
/* Date utilities (local time, no UTC drift)                  */
/* ---------------------------------------------------------- */

function pad2(n) { return String(n).padStart(2, '0'); }

function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function todayStr() { return toDateStr(new Date()); }

function parseDateStr(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(dateStr, n) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

function diffDays(aStr, bStr) {
  const a = parseDateStr(aStr);
  const b = parseDateStr(bStr);
  return Math.round((a - b) / 86400000);
}

function formatDateLabel(dateStr) {
  const d = parseDateStr(dateStr);
  const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

const MONTH_NAMES = ['JANUARY','FEBRUARY','MARCH','APRIL','MAY','JUNE','JULY','AUGUST','SEPTEMBER','OCTOBER','NOVEMBER','DECEMBER'];

/* ---------------------------------------------------------- */
/* Storage                                                     */
/* ---------------------------------------------------------- */

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore corrupt state */ }
  return null;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeId() { return Math.random().toString(36).slice(2, 10); }

function createDefaultRoutine() {
  return {
    id: makeId(),
    name: 'MY ROUTINE',
    startDate: todayStr(),
    completed: [],
    seenMilestones: [],
  };
}

let state = loadState();
if (!state || !Array.isArray(state.routines) || state.routines.length === 0) {
  const r = createDefaultRoutine();
  state = { routines: [r], activeRoutineId: r.id };
  saveState();
}
// migration safety
state.routines.forEach(r => { if (!r.seenMilestones) r.seenMilestones = []; });

function getActiveRoutine() {
  return state.routines.find(r => r.id === state.activeRoutineId) || state.routines[0];
}

/* ---------------------------------------------------------- */
/* Streak computation                                          */
/* ---------------------------------------------------------- */

// Returns array of segments: [{ dates: [sorted date strs] }], ordered oldest -> newest
function computeSegments(routine) {
  const sorted = [...routine.completed].sort();
  const segments = [];
  let current = null;
  for (const d of sorted) {
    if (current && diffDays(d, current.dates[current.dates.length - 1]) === 1) {
      current.dates.push(d);
    } else {
      current = { dates: [d] };
      segments.push(current);
    }
  }
  return segments;
}

function computeStats(routine) {
  const segments = computeSegments(routine);
  const today = todayStr();

  let currentStreak = 0;
  let currentSegment = null;
  if (segments.length > 0) {
    const last = segments[segments.length - 1];
    const lastDate = last.dates[last.dates.length - 1];
    const gap = diffDays(today, lastDate);
    if (gap === 0 || gap === 1) {
      currentStreak = last.dates.length;
      currentSegment = last;
    }
  }

  let bestStreak = 0;
  for (const seg of segments) bestStreak = Math.max(bestStreak, seg.dates.length);
  bestStreak = Math.max(bestStreak, currentStreak);

  const totalCompleted = routine.completed.length;

  const start = routine.startDate;
  const daysSinceStart = Math.max(1, diffDays(today, start) + 1);
  const completionPct = Math.min(100, Math.round((totalCompleted / daysSinceStart) * 100));
  const missedDays = Math.max(0, daysSinceStart - totalCompleted);

  const prevSegments = segments.filter(s => s !== currentSegment);

  return {
    segments, currentStreak, currentSegment, bestStreak,
    totalCompleted, daysSinceStart, completionPct, missedDays, prevSegments,
  };
}

/* ---------------------------------------------------------- */
/* SVG pixel tally rendering                                   */
/* ---------------------------------------------------------- */

// Builds one tally mark (single vertical scratch) as SVG markup.
// unit grid: width 6, height 24
function svgSingleMark(extraClass) {
  return `<svg class="${extraClass || ''}" width="18" height="72" viewBox="0 0 6 24" shape-rendering="crispEdges">
    <rect class="tally-mark-rect" x="2" y="1" width="2" height="22" />
  </svg>`;
}

// Builds a group-of-5 tally (4 verticals + diagonal slash) as SVG.
// grid: 4 verticals at x=2,9,16,23 each width 2, height 22 (y=1..23)
// total width 30, height 24. Diagonal slash stepped from bottom-left to top-right.
function svgGroupMark(count, isNew) {
  const W = 30, H = 24;
  let rects = '';
  const positions = [2, 9, 16, 23];
  for (let i = 0; i < count; i++) {
    rects += `<rect class="tally-mark-rect" x="${positions[i]}" y="1" width="2" height="22" />`;
  }
  if (count === 5) {
    // stepped diagonal from bottom-left to top-right, pixel-art staircase
    const steps = [
      [1, 20, 4, 3], [5, 16, 4, 3], [9, 12, 4, 3], [13, 8, 4, 3], [17, 4, 4, 3], [21, 1, 5, 3],
    ];
    for (const [x, y, w, h] of steps) {
      rects += `<rect class="tally-slash-rect" x="${x}" y="${y}" width="${w}" height="${h}" />`;
    }
  }
  const cls = isNew ? 'tally-mark-new' : '';
  return `<svg class="${cls}" width="${W * 3}" height="${H * 3}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">${rects}</svg>`;
}

function chunk5(arr) {
  const out = [];
  for (let i = 0; i < arr.length; i += 5) out.push(arr.slice(i, i + 5));
  return out;
}

/* ---------------------------------------------------------- */
/* DOM refs                                                     */
/* ---------------------------------------------------------- */

const el = {
  routineList: document.getElementById('routineList'),
  caseFile: document.getElementById('caseFile'),
  habitNameLabel: document.getElementById('habitNameLabel'),
  dayCounter: document.getElementById('dayCounter'),
  currentStreakVal: document.getElementById('currentStreakVal'),
  bestStreakVal: document.getElementById('bestStreakVal'),
  tallyStage: document.getElementById('tallyStage'),
  wallEmptyMsg: document.getElementById('wallEmptyMsg'),
  prevSentences: document.getElementById('prevSentences'),
  markTodayBtn: document.getElementById('markTodayBtn'),
  undoBtn: document.getElementById('undoBtn'),
  statsList: document.getElementById('statsList'),
  achievementsGrid: document.getElementById('achievementsGrid'),
  calendarLabel: document.getElementById('calendarLabel'),
  calendarGrid: document.getElementById('calendarGrid'),
  prevMonthBtn: document.getElementById('prevMonthBtn'),
  nextMonthBtn: document.getElementById('nextMonthBtn'),
  barLog: document.getElementById('barLog'),
  tooltip: document.getElementById('tooltip'),
  groupPopover: document.getElementById('groupPopover'),
  groupPopoverBody: document.getElementById('groupPopoverBody'),
  confirmModal: document.getElementById('confirmModal'),
  confirmTitle: document.getElementById('confirmTitle'),
  confirmBody: document.getElementById('confirmBody'),
  confirmYes: document.getElementById('confirmYes'),
  confirmNo: document.getElementById('confirmNo'),
  addRoutineBtn: document.getElementById('addRoutineBtn'),
  addRoutineModal: document.getElementById('addRoutineModal'),
  newRoutineName: document.getElementById('newRoutineName'),
  newRoutineStart: document.getElementById('newRoutineStart'),
  createRoutineBtn: document.getElementById('createRoutineBtn'),
  cancelRoutineBtn: document.getElementById('cancelRoutineBtn'),
  achievementPopup: document.getElementById('achievementPopup'),
  achievementIconSlot: document.getElementById('achievementIconSlot'),
  achievementPopupTitle: document.getElementById('achievementPopupTitle'),
  achievementPopupDays: document.getElementById('achievementPopupDays'),
  muteBtn: document.getElementById('muteBtn'),
  jailFrame: document.querySelector('.jail-frame'),
  app: document.getElementById('app'),
};

let calendarCursor = new Date(); // month being viewed
calendarCursor.setDate(1);

/* ---------------------------------------------------------- */
/* Rendering                                                    */
/* ---------------------------------------------------------- */

function renderAll(opts = {}) {
  const routine = getActiveRoutine();
  const stats = computeStats(routine);
  renderSidebar();
  renderWallHeader(routine, stats);
  renderTallyWall(routine, stats, opts.animateNew);
  renderStats(routine, stats);
  renderAchievements(routine, stats);
  renderCalendar(routine);
  renderBarLog(routine, stats);
  renderActionButtons(routine, stats);
}

function renderSidebar() {
  el.routineList.innerHTML = '';
  state.routines.forEach(r => {
    const li = document.createElement('li');
    li.className = 'routine-item' + (r.id === state.activeRoutineId ? ' active' : '');
    li.innerHTML = `<span class="routine-item-name">${escapeHtml(r.name)}</span>` +
      (state.routines.length > 1 ? `<button class="routine-delete-btn" data-id="${r.id}" title="Delete routine">×</button>` : '');
    li.addEventListener('click', (e) => {
      if (e.target.closest('.routine-delete-btn')) return;
      if (r.id === state.activeRoutineId) return;
      SoundFX.click();
      state.activeRoutineId = r.id;
      saveState();
      renderAll();
    });
    const delBtn = li.querySelector('.routine-delete-btn');
    if (delBtn) {
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        SoundFX.click();
        confirmAction(
          'DELETE ROUTINE',
          `Permanently delete "${r.name}" and all its tallies?`,
          () => {
            state.routines = state.routines.filter(x => x.id !== r.id);
            if (state.activeRoutineId === r.id) state.activeRoutineId = state.routines[0].id;
            saveState();
            renderAll();
            SoundFX.undo();
          }
        );
      });
    }
    el.routineList.appendChild(li);
  });

  const routine = getActiveRoutine();
  el.caseFile.innerHTML = `
    <div class="cf-row"><span class="cf-label">NAME</span><span class="cf-value">${escapeHtml(routine.name)}</span></div>
    <div class="cf-row"><span class="cf-label">START DATE</span><span class="cf-value">${formatDateLabel(routine.startDate)}</span></div>
  `;
}

function renderWallHeader(routine, stats) {
  el.habitNameLabel.textContent = routine.name;
  el.dayCounter.textContent = `DAY ${stats.currentStreak}`;
  el.currentStreakVal.textContent = `${stats.currentStreak} DAY${stats.currentStreak === 1 ? '' : 'S'}`;
  el.bestStreakVal.textContent = `${stats.bestStreak} DAY${stats.bestStreak === 1 ? '' : 'S'}`;
}

function renderTallyWall(routine, stats, animateNew) {
  el.tallyStage.innerHTML = '';

  const activeDates = stats.currentSegment ? stats.currentSegment.dates : [];

  if (activeDates.length === 0) {
    const msg = document.createElement('p');
    msg.className = 'wall-empty-msg';
    msg.textContent = 'NO ACTIVE SENTENCE. ADD A TALLY TO START.';
    el.tallyStage.appendChild(msg);
  } else {
    const groups = chunk5(activeDates);
    groups.forEach((group, gi) => {
      const wrap = document.createElement('div');
      wrap.className = 'tally-group';
      const isLastGroup = gi === groups.length - 1;
      const isNew = animateNew && isLastGroup;
      wrap.innerHTML = svgGroupMark(group.length, isNew);
      wrap.addEventListener('click', () => { SoundFX.open(); showGroupPopover(group); });
      wrap.addEventListener('mouseenter', (e) => showTooltip(e, `${group.length} TALLIES: ${formatDateLabel(group[0])} – ${formatDateLabel(group[group.length - 1])}`));
      wrap.addEventListener('mousemove', moveTooltip);
      wrap.addEventListener('mouseleave', hideTooltip);
      el.tallyStage.appendChild(wrap);
    });
  }

  // previous broken sentences
  el.prevSentences.innerHTML = '';
  const prevSegs = stats.prevSegments.slice(-4); // keep it compact
  prevSegs.forEach(seg => {
    const row = document.createElement('div');
    row.className = 'prev-sentence-row';
    const label = document.createElement('span');
    label.className = 'prev-sentence-label';
    label.textContent = `BROKEN — ${seg.dates.length} DAY${seg.dates.length === 1 ? '' : 'S'}`;
    const tallies = document.createElement('div');
    tallies.className = 'prev-sentence-tallies';
    chunk5(seg.dates).forEach(group => {
      const g = document.createElement('div');
      g.className = 'tally-group';
      g.innerHTML = svgGroupMark(group.length, false);
      g.addEventListener('click', () => { SoundFX.open(); showGroupPopover(group); });
      tallies.appendChild(g);
    });
    row.appendChild(label);
    row.appendChild(tallies);
    el.prevSentences.appendChild(row);
  });
}

function renderStats(routine, stats) {
  const rows = [
    ['CURRENT STREAK', `${stats.currentStreak} DAYS`],
    ['LONGEST SENTENCE', `${stats.bestStreak} DAYS`],
    ['TOTAL TALLIES', `${stats.totalCompleted}`],
    ['COMPLETION', `${stats.completionPct}%`],
    ['MISSED DAYS', `${stats.missedDays}`],
    ['DAYS TRACKED', `${stats.daysSinceStart}`],
  ];
  el.statsList.innerHTML = rows.map(([label, value]) => `
    <div class="stat-row"><dt>${label}</dt><dd>${value}</dd></div>
  `).join('');
}

function renderAchievements(routine, stats) {
  el.achievementsGrid.innerHTML = '';
  ACHIEVEMENTS.forEach(a => {
    const unlocked = stats.bestStreak >= a.days;
    const badge = document.createElement('div');
    badge.className = 'achievement-badge' + (unlocked ? ' unlocked' : '');
    badge.innerHTML = `
      ${renderPixelIcon(a.icon)}
      <div class="achievement-text">
        <span class="achievement-title">${a.code}</span>
        <span class="achievement-days">${a.days} DAYS</span>
      </div>
    `;
    el.achievementsGrid.appendChild(badge);
  });
}

function renderPixelIcon(iconKey) {
  const bitmap = ICON_BITMAPS[iconKey] || ICON_BITMAPS.star;
  let cells = '';
  for (const row of bitmap) {
    for (const c of row) {
      cells += `<span class="${c === '1' ? 'on' : ''}"></span>`;
    }
  }
  return `<div class="pixel-icon">${cells}</div>`;
}

function renderCalendar(routine) {
  const year = calendarCursor.getFullYear();
  const month = calendarCursor.getMonth();
  el.calendarLabel.textContent = `${MONTH_NAMES[month]} ${year}`;

  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();
  const completedSet = new Set(routine.completed);

  el.calendarGrid.innerHTML = '';
  for (let i = 0; i < startWeekday; i++) {
    const cell = document.createElement('div');
    cell.className = 'cal-cell empty';
    el.calendarGrid.appendChild(cell);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const cell = document.createElement('div');
    cell.className = 'cal-cell';
    cell.textContent = day;
    cell.dataset.date = dateStr;

    const isFuture = dateStr > today;
    const isBeforeStart = dateStr < routine.startDate;
    const isDone = completedSet.has(dateStr);

    if (isFuture) {
      cell.classList.add('future');
    } else if (isDone) {
      cell.classList.add('done');
    } else if (!isBeforeStart) {
      cell.classList.add('missed');
    }
    if (dateStr === today) cell.classList.add('today');
    if (dateStr === routine.startDate) cell.classList.add('start-day');

    if (!isFuture && !isBeforeStart) {
      cell.classList.add('in-range');
      cell.addEventListener('click', () => toggleDay(dateStr, cell));
    }
    cell.addEventListener('mouseenter', (e) => showTooltip(e, formatDateLabel(dateStr) + (isDone ? ' — TALLY MARKED' : '')));
    cell.addEventListener('mousemove', moveTooltip);
    cell.addEventListener('mouseleave', hideTooltip);

    el.calendarGrid.appendChild(cell);
  }
}

function renderBarLog(routine, stats) {
  el.barLog.innerHTML = '';
  const activeDates = stats.currentSegment ? stats.currentSegment.dates : [];
  if (activeDates.length === 0) {
    el.barLog.innerHTML = '<p class="bar-log-empty">NO TALLIES IN CURRENT SENTENCE YET.</p>';
    return;
  }
  const recent = [...activeDates].reverse().slice(0, 12);
  const maxN = activeDates.length;
  recent.forEach((dateStr, idx) => {
    const dayNumber = maxN - idx;
    const pct = Math.max(8, Math.round((dayNumber / Math.max(maxN, 1)) * 100));
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-day-label">DAY ${dayNumber}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    `;
    row.title = formatDateLabel(dateStr);
    el.barLog.appendChild(row);
  });
}

function renderActionButtons(routine, stats) {
  const today = todayStr();
  const doneToday = routine.completed.includes(today);
  if (doneToday) {
    el.markTodayBtn.textContent = 'TODAY COMPLETE';
    el.markTodayBtn.classList.add('btn-complete-state');
    el.markTodayBtn.disabled = true;
    el.undoBtn.hidden = false;
  } else {
    el.markTodayBtn.textContent = '+ MARK TODAY COMPLETE';
    el.markTodayBtn.classList.remove('btn-complete-state');
    el.markTodayBtn.disabled = false;
    el.undoBtn.hidden = true;
  }
}

/* ---------------------------------------------------------- */
/* Interactions                                                 */
/* ---------------------------------------------------------- */

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Adds a completion for dateStr, playing the matching sound/animation.
// originEl: the element the celebration should burst from (button or calendar cell).
function addCompletion(dateStr, originEl) {
  const routine = getActiveRoutine();
  if (routine.completed.includes(dateStr)) return;

  // capture before re-render: a calendar-cell origin won't survive the rebuild
  const originRect = (originEl || el.markTodayBtn).getBoundingClientRect();

  routine.completed.push(dateStr);
  routine.completed.sort();
  saveState();

  const isToday = dateStr === todayStr();
  renderAll({ animateNew: isToday });

  const stats = computeStats(routine);
  const justCompletedGroup = stats.currentStreak > 0 && stats.currentStreak % 5 === 0
    && stats.currentSegment && stats.currentSegment.dates.includes(dateStr);

  if (isToday) flashButton();

  const newMark = document.querySelector('.tally-mark-new');
  const burstRect = newMark ? newMark.getBoundingClientRect() : originRect;
  spawnParticles(burstRect, justCompletedGroup);

  if (justCompletedGroup) {
    SoundFX.groupComplete();
    triggerShake(el.jailFrame, 'shake-sm');
  } else {
    SoundFX.tally();
  }

  checkMilestones(routine);
}

function removeCompletion(dateStr) {
  const routine = getActiveRoutine();
  routine.completed = routine.completed.filter(d => d !== dateStr);
  saveState();
  renderAll();
  SoundFX.undo();
}

function toggleDay(dateStr, cellEl) {
  const routine = getActiveRoutine();
  if (routine.completed.includes(dateStr)) {
    removeCompletion(dateStr);
  } else {
    addCompletion(dateStr, cellEl);
    const cell = document.querySelector(`.cal-cell[data-date="${dateStr}"]`);
    if (cell) {
      cell.classList.remove('pop');
      void cell.offsetWidth;
      cell.classList.add('pop');
    }
  }
}

function markToday() {
  const today = todayStr();
  addCompletion(today, el.markTodayBtn);
}

function undoToday() {
  SoundFX.click();
  confirmAction(
    'UNDO TALLY',
    'Remove today’s tally mark from the wall?',
    () => removeCompletion(todayStr())
  );
}

function checkMilestones(routine) {
  const stats = computeStats(routine);
  for (const a of ACHIEVEMENTS) {
    if (stats.currentStreak === a.days && !routine.seenMilestones.includes(a.days)) {
      routine.seenMilestones.push(a.days);
      saveState();
      showAchievementPopup(a);
      break;
    }
  }
}

function showAchievementPopup(a) {
  el.achievementIconSlot.innerHTML = renderPixelIcon(a.icon);
  el.achievementPopupTitle.textContent = a.code;
  el.achievementPopupDays.textContent = `${a.days} DAYS`;
  el.achievementPopup.hidden = false;
  SoundFX.milestone();
  triggerShake(el.app, 'shake-lg');
  clearTimeout(showAchievementPopup._t);
  showAchievementPopup._t = setTimeout(() => { el.achievementPopup.hidden = true; }, 3600);
}

function flashButton() {
  el.markTodayBtn.classList.remove('flash');
  void el.markTodayBtn.offsetWidth;
  el.markTodayBtn.classList.add('flash');
}

// Brief squash-and-settle pulse on any button after an action.
function pulseButton(target) {
  if (!target || !target.classList) return;
  target.classList.remove('pressed');
  void target.offsetWidth;
  target.classList.add('pressed');
}

function triggerShake(target, cls) {
  if (!target) return;
  target.classList.remove('shake-sm', 'shake-lg');
  void target.offsetWidth;
  target.classList.add(cls);
  setTimeout(() => target.classList.remove(cls), 500);
}

function spawnParticles(rect, big) {
  const count = big ? 16 : 9;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle' + (big ? ' particle-big' : '');
    p.style.position = 'fixed';
    p.style.left = `${rect.left + rect.width / 2}px`;
    p.style.top = `${rect.top + rect.height / 2}px`;
    p.style.background = Math.random() > 0.5 ? 'var(--amber)' : 'var(--cream)';
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const dist = (big ? 40 : 26) + Math.random() * 24;
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist - 16}px`);
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 750);
  }
}

/* ---------- tooltip ---------- */
function showTooltip(e, text) {
  el.tooltip.textContent = text;
  el.tooltip.hidden = false;
  moveTooltip(e);
}
function moveTooltip(e) {
  el.tooltip.style.left = `${e.clientX + 14}px`;
  el.tooltip.style.top = `${e.clientY + 14}px`;
}
function hideTooltip() { el.tooltip.hidden = true; }

/* ---------- group popover ---------- */
function showGroupPopover(dates) {
  el.groupPopoverBody.innerHTML = dates.map((d, i) => `
    <div class="group-date-row"><span>TALLY ${i + 1}</span><span>${formatDateLabel(d)}</span></div>
  `).join('');
  el.groupPopover.hidden = false;
}
el.groupPopover.addEventListener('click', (e) => {
  if (e.target === el.groupPopover || e.target.closest('[data-close]')) {
    el.groupPopover.hidden = true;
    SoundFX.close();
  }
});

/* ---------- confirm modal ---------- */
let confirmCallback = null;
function confirmAction(title, body, onYes) {
  el.confirmTitle.textContent = title;
  el.confirmBody.textContent = body;
  confirmCallback = onYes;
  el.confirmModal.hidden = false;
}
el.confirmYes.addEventListener('click', () => {
  el.confirmModal.hidden = true;
  if (confirmCallback) confirmCallback();
  confirmCallback = null;
});
el.confirmNo.addEventListener('click', () => {
  el.confirmModal.hidden = true;
  confirmCallback = null;
  SoundFX.close();
});
el.confirmModal.addEventListener('click', (e) => {
  if (e.target === el.confirmModal) { el.confirmModal.hidden = true; confirmCallback = null; }
});

/* ---------- add routine modal ---------- */
el.addRoutineBtn.addEventListener('click', () => {
  el.newRoutineName.value = '';
  el.newRoutineStart.value = todayStr();
  el.addRoutineModal.hidden = false;
  el.newRoutineName.focus();
  SoundFX.open();
});
el.cancelRoutineBtn.addEventListener('click', () => { el.addRoutineModal.hidden = true; SoundFX.close(); });
el.addRoutineModal.addEventListener('click', (e) => { if (e.target === el.addRoutineModal) el.addRoutineModal.hidden = true; });
el.createRoutineBtn.addEventListener('click', () => {
  const name = el.newRoutineName.value.trim() || 'MY ROUTINE';
  const startDate = el.newRoutineStart.value || todayStr();
  const r = { id: makeId(), name: name.toUpperCase(), startDate, completed: [], seenMilestones: [] };
  state.routines.push(r);
  state.activeRoutineId = r.id;
  saveState();
  el.addRoutineModal.hidden = true;
  calendarCursor = new Date(); calendarCursor.setDate(1);
  renderAll();
  SoundFX.tally();
});

/* ---------- calendar nav ---------- */
el.prevMonthBtn.addEventListener('click', () => {
  calendarCursor.setMonth(calendarCursor.getMonth() - 1);
  renderCalendar(getActiveRoutine());
  SoundFX.click();
});
el.nextMonthBtn.addEventListener('click', () => {
  calendarCursor.setMonth(calendarCursor.getMonth() + 1);
  renderCalendar(getActiveRoutine());
  SoundFX.click();
});

/* ---------- mute toggle ---------- */
function updateMuteBtn() {
  el.muteBtn.textContent = SoundFX.isMuted() ? 'SFX: OFF' : 'SFX: ON';
}
el.muteBtn.addEventListener('click', () => {
  SoundFX.setMuted(!SoundFX.isMuted());
  updateMuteBtn();
  if (!SoundFX.isMuted()) SoundFX.click();
});
updateMuteBtn();

/* ---------- main actions ---------- */
el.markTodayBtn.addEventListener('click', markToday);
el.undoBtn.addEventListener('click', undoToday);

/* ---------- generic pixel-button press feedback (visual only) ---------- */
// Note: don't gate on btn.disabled here — a handler higher in the same
// click (e.g. markToday) may disable the button synchronously before this
// delegated listener runs during bubbling, even though the click was valid.
document.addEventListener('click', (e) => {
  const btn = e.target.closest('.pixel-btn');
  if (btn) pulseButton(btn);
});

/* ---------------------------------------------------------- */
/* Init                                                         */
/* ---------------------------------------------------------- */
renderAll();
