import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import {
  isComplete, progressOf, valueOf, targetFor, stepFor, formatDuration, TYPE_RULES,
} from './completion';
import {
  XP_RULES, totalXpForLevel, levelForXp, titleForLevel, xpForCompletion,
  isPerfectDay, computeXpBreakdown, computeProgression,
} from './xp';

const habit = (over = {}) => createHabit({ name: 'H', startDate: '2026-09-01', ...over });
const water = () => habit({ name: 'WATER', type: 'count', target: 8, unit: 'GLASSES', difficulty: 'easy' });
const study = () => habit({ name: 'STUDY', type: 'duration', target: 7200, difficulty: 'hard' });
const read = () => habit({ name: 'READ', type: 'numeric', target: 30, unit: 'PAGES' });

describe('completion rules by type', () => {
  it('boolean is done when the record says so', () => {
    const h = habit();
    expect(isComplete(h, { completed: true })).toBe(true);
    expect(isComplete(h, { completed: false })).toBe(false);
    expect(isComplete(h, undefined)).toBe(false);
  });

  it('count needs the target met', () => {
    const h = water();
    expect(isComplete(h, { value: 7 })).toBe(false);
    expect(isComplete(h, { value: 8 })).toBe(true);
    expect(isComplete(h, { value: 9 })).toBe(true);   // overshooting still counts
  });

  it('duration compares seconds', () => {
    const h = study();
    expect(isComplete(h, { value: 7199 })).toBe(false);
    expect(isComplete(h, { value: 7200 })).toBe(true);
  });

  it('numeric compares the amount', () => {
    expect(isComplete(read(), { value: 29 })).toBe(false);
    expect(isComplete(read(), { value: 42 })).toBe(true);
  });

  it('a measured habit with no record is simply not done', () => {
    expect(isComplete(water(), undefined)).toBe(false);
    expect(valueOf(water(), undefined)).toBe(0);
  });

  it('ignores nonsense values rather than throwing', () => {
    for (const bad of [null, undefined, NaN, -5, 'x', {}]) {
      expect(valueOf(water(), { value: bad })).toBe(0);
      expect(isComplete(water(), { value: bad })).toBe(false);
    }
  });

  it('treats a missing or unknown type as boolean', () => {
    expect(isComplete({ type: 'nonsense' }, { completed: true })).toBe(true);
    expect(isComplete({}, { completed: true })).toBe(true);
  });

  it('never divides by a zero target', () => {
    const broken = { type: 'count', target: 0 };
    expect(targetFor(broken)).toBe(1);
    expect(progressOf(broken, { value: 1 }).pct).toBe(100);
  });

  it('reports progress for the water counter', () => {
    const p = progressOf(water(), { value: 6 });
    expect(p).toMatchObject({ value: 6, target: 8, complete: false });
    expect(p.pct).toBe(75);
    expect(p.text).toBe('6 / 8');
  });

  it('caps the displayed percentage at 100', () => {
    expect(progressOf(water(), { value: 99 }).pct).toBe(100);
  });

  it('formats durations readably', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(102 * 60)).toBe('1:42:00');
    expect(formatDuration(90)).toBe('01:30');
  });

  it('steps by something sensible per type', () => {
    expect(stepFor(water())).toBe(1);
    expect(stepFor(study())).toBe(300);          // 5 minutes
    expect(stepFor(read())).toBe(3);             // a tenth of 30 pages
    expect(stepFor(habit())).toBe(1);
  });

  it('exposes every supported type', () => {
    expect(Object.keys(TYPE_RULES).sort()).toEqual(['boolean', 'count', 'duration', 'numeric']);
  });
});

describe('level curve', () => {
  it('starts at level 1 with nothing', () => {
    expect(levelForXp(0)).toBe(1);
    expect(totalXpForLevel(1)).toBe(0);
  });

  it('rises monotonically', () => {
    for (let l = 1; l < 120; l++) {
      expect(totalXpForLevel(l + 1)).toBeGreaterThan(totalXpForLevel(l));
    }
  });

  it('agrees with its own inverse at every boundary', () => {
    for (let l = 1; l <= 120; l++) {
      const need = totalXpForLevel(l);
      expect(levelForXp(need)).toBe(l);
      if (l > 1) expect(levelForXp(need - 1)).toBe(l - 1);
    }
  });

  it('handles junk input', () => {
    expect(levelForXp(-100)).toBe(1);
    expect(levelForXp(0)).toBe(1);
  });

  it('awards titles by threshold', () => {
    expect(titleForLevel(1)).toBe('APPRENTICE');
    expect(titleForLevel(4)).toBe('APPRENTICE');
    expect(titleForLevel(5)).toBe('SQUIRE');
    expect(titleForLevel(19)).toBe('PAGE');
    expect(titleForLevel(20)).toBe('KNIGHT');
    expect(titleForLevel(27)).toBe('KNIGHT');
    expect(titleForLevel(100)).toBe('GRANDMASTER');
    expect(titleForLevel(999)).toBe('GRANDMASTER');
  });
});

describe('xp per completion', () => {
  it('scales with difficulty', () => {
    expect(xpForCompletion(habit({ difficulty: 'easy' }))).toBe(10);
    expect(xpForCompletion(habit({ difficulty: 'normal' }))).toBe(20);
    expect(xpForCompletion(habit({ difficulty: 'hard' }))).toBe(30);
  });

  it('falls back to normal for an unknown difficulty', () => {
    expect(xpForCompletion({ difficulty: 'legendary' })).toBe(XP_RULES.perCompletion.normal);
  });
});

describe('perfect days', () => {
  const h1 = habit({ id: 'a', difficulty: 'easy' });
  const h2 = habit({ id: 'b', difficulty: 'hard' });

  it('needs every scheduled habit done', () => {
    const done = { a: { '2026-09-01': { completed: true } }, b: { '2026-09-01': { completed: true } } };
    expect(isPerfectDay([h1, h2], done, '2026-09-01')).toBe(true);
    expect(isPerfectDay([h1, h2], { a: done.a, b: {} }, '2026-09-01')).toBe(false);
  });

  it('does not count a day with nothing due', () => {
    // Both habits are weekly on Mondays; 2026-09-01 is a Tuesday.
    const weekly = habit({ id: 'w', schedule: { frequency: 'weekly', weekdays: [1] } });
    expect(isPerfectDay([weekly], { w: {} }, '2026-09-01')).toBe(false);
  });

  it('ignores habits that had not started yet', () => {
    const later = habit({ id: 'late', startDate: '2026-10-01' });
    const done = { a: { '2026-09-01': { completed: true } }, late: {} };
    expect(isPerfectDay([h1, later], done, '2026-09-01')).toBe(true);
  });
});

describe('xp is derived, not accumulated', () => {
  const h = habit({ id: 'x', difficulty: 'normal' });

  it('totals completions and perfect-day bonuses', () => {
    const completions = { x: { '2026-09-01': { completed: true }, '2026-09-02': { completed: true } } };
    const b = computeXpBreakdown([h], completions, '2026-09-02');
    // 2 completions at 20, plus 2 perfect days at 50
    expect(b.fromCompletions).toBe(40);
    expect(b.fromPerfectDays).toBe(100);
    expect(b.total).toBe(140);
    expect(b.perfectDays).toEqual(['2026-09-01', '2026-09-02']);
  });

  it('cannot be farmed by completing and undoing', () => {
    const before = computeXpBreakdown([h], { x: {} }, '2026-09-02').total;
    const afterComplete = computeXpBreakdown([h], { x: { '2026-09-01': { completed: true } } }, '2026-09-02').total;
    const afterUndo = computeXpBreakdown([h], { x: {} }, '2026-09-02').total;
    const afterRedo = computeXpBreakdown([h], { x: { '2026-09-01': { completed: true } } }, '2026-09-02').total;

    expect(afterComplete).toBeGreaterThan(before);
    expect(afterUndo).toBe(before);        // undoing gives the XP straight back
    expect(afterRedo).toBe(afterComplete); // redoing restores it, and no more
  });

  it('is stable no matter how many times it is recomputed', () => {
    const completions = { x: { '2026-09-01': { completed: true } } };
    const runs = [1, 2, 3].map(() => computeXpBreakdown([h], completions, '2026-09-03').total);
    expect(new Set(runs).size).toBe(1);
  });

  it('awards nothing for a partially filled counter', () => {
    const w = water();
    const partial = { [w.id]: { '2026-09-01': { value: 7 } } };
    expect(computeXpBreakdown([w], partial, '2026-09-01').total).toBe(0);

    const full = { [w.id]: { '2026-09-01': { value: 8 } } };
    // easy completion (10) + perfect day (50)
    expect(computeXpBreakdown([w], full, '2026-09-01').total).toBe(60);
  });

  it('handles no habits at all', () => {
    expect(computeXpBreakdown([], {}, '2026-09-01').total).toBe(0);
    expect(computeProgression([], {}, '2026-09-01').level).toBe(1);
  });

  it('ignores a habit whose start date is in the future', () => {
    const future = habit({ id: 'f', startDate: '2099-01-01' });
    expect(computeXpBreakdown([future], { f: {} }, '2026-09-01').total).toBe(0);
  });
});

describe('progression for display', () => {
  it('reports level, title and progress within the level', () => {
    const h = habit({ id: 'p', difficulty: 'hard' });
    const completions = { p: {} };
    for (let d = 1; d <= 10; d++) completions.p[`2026-09-${String(d).padStart(2, '0')}`] = { completed: true };

    const prog = computeProgression([h], completions, '2026-09-10');
    // 10 days x (30 hard + 50 perfect) = 800
    expect(prog.xp).toBe(800);
    expect(prog.level).toBe(levelForXp(800));
    expect(prog.title).toBe(titleForLevel(prog.level));
    expect(prog.perfectDayCount).toBe(10);
    expect(prog.xpIntoLevel + prog.xpRemaining).toBe(prog.xpForNextLevel);
    expect(prog.progressPct).toBeGreaterThanOrEqual(0);
    expect(prog.progressPct).toBeLessThanOrEqual(100);
  });
});
