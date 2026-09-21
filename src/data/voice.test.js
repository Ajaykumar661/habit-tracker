import { describe, it, expect } from 'vitest';
import { VOICES, voiceFor, voicedAchievement } from './voice';
import { THEME_IDS } from '../domain/schema';
import { CATALOGUE } from '../domain/achievements';
import { BREAK_REASONS } from '../domain/history';
import { recoveryMessage } from '../domain/recovery';
import { reportVerdict } from '../domain/analytics';
import { questSummary } from '../domain/quests';
import { titleForLevel } from '../domain/xp';
import { pickQuote, QUOTES, DAY_EXACT } from './quotes';
import { NEON_QUOTES, NEON_DAY_EXACT } from './quotes-neon';
import { GUIDE_PAGES } from './guide';
import { NEON_GUIDE_PAGES } from './guide-neon';
import { ICON_BITMAPS } from '../lib/achievements';

/** Every key path in an object, arrays and functions treated as leaves. */
function shape(o, prefix = '') {
  return Object.keys(o).sort().flatMap((k) => {
    const v = o[k];
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v) && k !== 'names' && k !== 'pools' && k !== 'exact') {
      return shape(v, path);
    }
    return [path];
  });
}

describe('every world has a whole voice', () => {
  it('has a voice for every theme the app ships', () => {
    for (const id of THEME_IDS) expect(VOICES[id], id).toBeDefined();
  });

  it('gives every voice exactly the same keys', () => {
    // a key missing from one world would render as blank, or crash
    expect(shape(VOICES.neon)).toEqual(shape(VOICES.medieval));
  });

  it('leaves no word empty', () => {
    for (const [id, voice] of Object.entries(VOICES)) {
      for (const path of shape(voice)) {
        const value = path.split('.').reduce((o, k) => o[k], voice);
        if (typeof value === 'string') expect(value.trim(), `${id}: ${path}`).not.toBe('');
      }
    }
  });

  it('makes every phrase function produce text', () => {
    for (const [id, v] of Object.entries(VOICES)) {
      expect(v.notice.risk(12), id).toMatch(/12/);
      expect(v.lost.best(1), id).toMatch(/1 DAY\b/);
      expect(v.lost.best(9), id).toMatch(/9 DAYS/);
      expect(v.lost.cta(3), id).toMatch(/3/);
      expect(v.confirm.retireBody('READ'), id).toContain('READ');
      expect(v.confirm.purgeBody('READ'), id).toContain('READ');
      expect(v.settings.before(4), id).toContain('4AM');
      expect(v.settings.saved(10, 1), id).toMatch(/10/);
      expect(v.history.summary(2, 'X, Y'), id).toContain('X, Y');
    }
  });

  it('falls back to the keep for an unknown theme', () => {
    expect(voiceFor('space')).toBe(VOICES.medieval);
    expect(voiceFor(undefined)).toBe(VOICES.medieval);
  });
});

describe('the medieval voice is the words the app always used', () => {
  const v = VOICES.medieval;
  it('keeps its own labels', () => {
    expect(v.quest.board).toBe('TODAY’S QUEST');
    expect(v.stats.best).toBe('LONGEST SENTENCE');
    expect(v.action.mark).toBe('+ MARK TODAY COMPLETE');
    expect(v.report.title).toBe('KINGDOM REPORT');
  });

  it('adds no achievement renames', () => {
    expect(v.achievements.names).toEqual({});
  });
});

describe('the neon voice', () => {
  const v = VOICES.neon;

  it('names its own ranks, in rising order from level 1', () => {
    expect(v.level.titles[0]).toEqual({ level: 1, title: 'ROOKIE' });
    const levels = v.level.titles.map((t) => t.level);
    expect([...levels].sort((a, b) => a - b)).toEqual(levels);
    expect(titleForLevel(22, v.level.titles)).toBe('NETRUNNER');
  });

  it('renames every achievement it lists, and only real ones', () => {
    const ids = CATALOGUE.map((a) => a.id);
    for (const id of Object.keys(v.achievements.names)) expect(ids, id).toContain(id);
    for (const id of ids) expect(v.achievements.names[id]?.title, id).toBeTruthy();
  });

  it('keeps the catalogue’s progress when renaming an achievement', () => {
    const a = { id: 'century', title: 'CENTURY', desc: 'x', target: 100, current: 12, pct: 12 };
    const named = voicedAchievement(v, a);
    expect(named.title).toBe('TRIPLE DIGITS');
    expect(named.current).toBe(12);
    expect(named.target).toBe(100);
  });

  it('labels every break reason', () => {
    for (const r of BREAK_REASONS) expect(v.history.reasons[r.id], r.id).toBeTruthy();
  });

  it('is what the domain says when handed it', () => {
    expect(recoveryMessage({ active: true, complete: true }, v.rally.words)).toContain('REBOOT');
    expect(reportVerdict({ enough: true, rate: 1 }, v.report.words)).toContain('PACKET');
    expect(questSummary({ total: 2, allComplete: true, doneCount: 2 }, v.quest.summary)).toBe('ALL CLEAR');
  });

  it('never scolds, however the week went', () => {
    for (const rate of [0, 0.2, 0.6, 0.9, 1]) {
      expect(reportVerdict({ enough: true, rate }, v.report.words)).not.toMatch(/FAIL|BAD|POOR|LAZY|WEAK/);
    }
  });
});

describe('quotes, in both voices', () => {
  it('fills every pool the keep has', () => {
    expect(Object.keys(NEON_QUOTES).sort()).toEqual(Object.keys(QUOTES).sort());
    for (const [k, pool] of Object.entries(NEON_QUOTES)) expect(pool.length, k).toBeGreaterThan(0);
  });

  it('marks the same exact days', () => {
    expect(Object.keys(NEON_DAY_EXACT).sort()).toEqual(Object.keys(DAY_EXACT).sort());
  });

  it('picks from the pools it is given', () => {
    const neonLine = pickQuote({ envState: 'night', currentStreak: 7 }, VOICES.neon.quotes);
    expect(NEON_DAY_EXACT[7]).toContain(neonLine);
  });
});

describe('the operator’s manual', () => {
  it('teaches the same topics as the warden’s guide, in the same order', () => {
    expect(NEON_GUIDE_PAGES.map((p) => p.id)).toEqual(GUIDE_PAGES.map((p) => p.id));
  });

  it('only asks for icons that exist', () => {
    for (const p of NEON_GUIDE_PAGES) expect(ICON_BITMAPS[p.icon], p.id).toBeDefined();
  });

  it('keeps every point short enough for a phone', () => {
    for (const p of NEON_GUIDE_PAGES) {
      for (const point of p.points) expect(point.length, point).toBeLessThanOrEqual(140);
    }
  });

  it('uses the words the neon screens actually show', () => {
    const text = JSON.stringify(NEON_GUIDE_PAGES).toUpperCase();
    for (const word of ['LOG TODAY', 'UNDO LOG', 'MISSION', 'FIREWALL', 'REBOOT', 'STATS', 'UNLOCKS', 'CITY REPORT', 'EXPORT']) {
      expect(text, word).toContain(word);
    }
  });

  it('still tells the reader their data never leaves the device', () => {
    const text = JSON.stringify(NEON_GUIDE_PAGES).toLowerCase();
    expect(text).toContain('device');
    expect(text).toMatch(/no account|no server/);
  });
});
