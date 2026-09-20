import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import {
  applyEdit, editImpact, impactWarnings, nameTaken, EDITABLE, FROZEN,
} from './editing';

const START = '2026-09-10';
const TODAY = '2026-09-21';
const mk = (over) => createHabit({ id: 'h', name: 'WATER', startDate: START, ...over });
const water = mk({ type: 'count', target: 8, unit: 'glasses' });
const marksOf = (dates, value) =>
  Object.fromEntries(dates.map((d) => [d, { date: d, value }]));

// Sep 16..21 logged at 8 glasses each — complete against a target of 8.
const eights = marksOf(
  ['2026-09-16', '2026-09-17', '2026-09-18', '2026-09-19', '2026-09-20', '2026-09-21'], 8,
);

describe('applying an edit', () => {
  it('changes the fields it is given', () => {
    const next = applyEdit(water, { name: 'HYDRATE', target: 10 });
    expect(next.name).toBe('HYDRATE');
    expect(next.target).toBe(10);
  });

  it('leaves everything else alone', () => {
    const next = applyEdit(water, { name: 'HYDRATE' });
    expect(next.unit).toBe('glasses');
    expect(next.id).toBe('h');
  });

  it('refuses to change the kind of quest', () => {
    expect(applyEdit(water, { type: 'duration' }).type).toBe('count');
  });

  it('refuses to move the start date', () => {
    expect(applyEdit(water, { startDate: '2020-01-01' }).startDate).toBe(START);
  });

  it('names a reason for every frozen field', () => {
    for (const [field, reason] of Object.entries(FROZEN)) {
      expect(reason, field).toBeTruthy();
      expect(EDITABLE).not.toContain(field);
    }
  });

  it('never mutates the habit it is given', () => {
    const snapshot = JSON.stringify(water);
    applyEdit(water, { name: 'OTHER', target: 99 });
    expect(JSON.stringify(water)).toBe(snapshot);
  });
});

describe('what an edit would cost', () => {
  it('calls a rename harmless', () => {
    const impact = editImpact(water, eights, { name: 'HYDRATE' }, TODAY);
    expect(impact.safe).toBe(true);
    expect(impact.marksLost).toHaveLength(0);
    expect(impactWarnings(impact)).toEqual([]);
  });

  it('catches a raised target re-judging the past', () => {
    const impact = editImpact(water, eights, { target: 10 }, TODAY);
    expect(impact.marksLost).toHaveLength(6);
    expect(impact.safe).toBe(false);
  });

  it('spells out the streak that would be lost', () => {
    const impact = editImpact(water, eights, { target: 10 }, TODAY);
    expect(impact.streakBefore).toBe(6);
    expect(impact.streakAfter).toBe(0);
    expect(impactWarnings(impact).join(' ')).toContain('FROM 6 TO 0');
  });

  it('counts the days that would stop counting', () => {
    const impact = editImpact(water, eights, { target: 10 }, TODAY);
    expect(impactWarnings(impact)[0]).toContain('6 RECORDED DAYS');
  });

  it('says "day" rather than "days" for a single one', () => {
    const one = marksOf(['2026-09-21'], 8);
    const impact = editImpact(water, one, { target: 10 }, TODAY);
    expect(impactWarnings(impact)[0]).toContain('1 RECORDED DAY ');
  });

  it('calls a lowered target safe, and notices days it would recover', () => {
    const partial = marksOf(['2026-09-20', '2026-09-21'], 5);
    const impact = editImpact(water, partial, { target: 4 }, TODAY);
    expect(impact.marksGained).toHaveLength(2);
    expect(impact.marksLost).toHaveLength(0);
    expect(impact.safe).toBe(true);
  });

  it('notices a schedule that adds due days', () => {
    const weekly = mk({ type: 'boolean', schedule: { frequency: 'weekly', weekdays: [1] } });
    const impact = editImpact(
      weekly, {}, { schedule: { frequency: 'daily', weekdays: [0, 1, 2, 3, 4, 5, 6] } }, TODAY,
    );
    expect(impact.dueAfter).toBeGreaterThan(impact.dueBefore);
  });

  it('knows when nothing was actually changed', () => {
    expect(editImpact(water, eights, { name: 'WATER' }, TODAY).changed).toBe(false);
    expect(editImpact(water, eights, { name: 'OTHER' }, TODAY).changed).toBe(true);
  });

  it('reads an empty record without throwing', () => {
    const impact = editImpact(water, {}, { target: 99 }, TODAY);
    expect(impact.marksLost).toEqual([]);
    expect(impact.safe).toBe(true);
  });

  it('never mutates the record it reads', () => {
    const snapshot = JSON.stringify(eights);
    editImpact(water, eights, { target: 10 }, TODAY);
    expect(JSON.stringify(eights)).toBe(snapshot);
  });
});

describe('duplicate names', () => {
  const habits = [mk({ id: 'a', name: 'READ' }), mk({ id: 'b', name: 'GYM' })];

  it('spots a name already in use', () => {
    expect(nameTaken(habits, 'READ')).toBe(true);
  });

  it('ignores case and surrounding space', () => {
    expect(nameTaken(habits, '  read ')).toBe(true);
  });

  it('lets a quest keep its own name', () => {
    expect(nameTaken(habits, 'READ', 'a')).toBe(false);
  });

  it('allows a name freed up by archiving', () => {
    const withArchived = [mk({ id: 'c', name: 'SWIM', archivedAt: '2026-09-01T00:00:00Z' })];
    expect(nameTaken(withArchived, 'SWIM')).toBe(false);
  });

  it('says nothing about an empty name', () => {
    expect(nameTaken(habits, '   ')).toBe(false);
  });
});
