import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { buildQuestBoard, questSummary } from './quests';

const MON = '2026-09-07';
const mk = (over) => createHabit({ startDate: MON, ...over });
const on = (dates, extra = {}) => Object.fromEntries(dates.map((d) => [d, { completed: true, ...extra }]));

describe('quest board', () => {
  const read = mk({ id: 'read', name: 'READ' });
  const water = mk({ id: 'water', name: 'WATER', type: 'count', target: 8, unit: 'GLASSES' });
  const gym = mk({ id: 'gym', name: 'GYM', schedule: { frequency: 'weekly', weekdays: [1, 3, 5] } });
  const sunday = mk({ id: 'sun', name: 'LAUNDRY', schedule: { frequency: 'weekly', weekdays: [0] } });

  it('splits what is due today from what is not', () => {
    const board = buildQuestBoard([read, water, gym, sunday], {}, MON);   // Monday
    expect(board.due.map((e) => e.habit.id).sort()).toEqual(['gym', 'read', 'water']);
    expect(board.later.map((e) => e.habit.id)).toEqual(['sun']);
  });

  it('counts only what is due toward the tally', () => {
    const completions = { read: on([MON]), water: {}, gym: on([MON]), sun: {} };
    const board = buildQuestBoard([read, water, gym, sunday], completions, MON);
    expect(board.total).toBe(3);
    expect(board.doneCount).toBe(2);
    expect(board.remaining).toBe(1);
    expect(board.allComplete).toBe(false);
    expect(questSummary(board)).toBe('2 / 3 COMPLETE');
  });

  it('is complete only when every due quest is done', () => {
    const completions = {
      read: on([MON]),
      water: { [MON]: { value: 8 } },
      gym: on([MON]),
      sun: {},
    };
    const board = buildQuestBoard([read, water, gym, sunday], completions, MON);
    expect(board.allComplete).toBe(true);
    expect(questSummary(board)).toBe('QUEST COMPLETE');
  });

  it('does not treat a partly filled counter as done', () => {
    const board = buildQuestBoard([water], { water: { [MON]: { value: 7 } } }, MON);
    expect(board.doneCount).toBe(0);
    expect(board.due[0].progress.text).toBe('7 / 8');
  });

  it('an empty board is not a completed one', () => {
    const board = buildQuestBoard([sunday], {}, MON);   // nothing due on Monday
    expect(board.total).toBe(0);
    expect(board.allComplete).toBe(false);
    expect(questSummary(board)).toBe('NO QUESTS TODAY');
  });

  it('leaves out archived habits entirely', () => {
    const gone = mk({ id: 'gone', archivedAt: '2026-09-01T00:00:00.000Z' });
    const board = buildQuestBoard([read, gone], {}, MON);
    expect(board.due.map((e) => e.habit.id)).toEqual(['read']);
    expect(board.later).toHaveLength(0);
  });

  it('describes the schedule of anything not due', () => {
    const board = buildQuestBoard([sunday], {}, MON);
    expect(board.later[0].schedule).toBe('SUN');
  });

  it('survives junk input', () => {
    expect(buildQuestBoard(null, null, MON).total).toBe(0);
    expect(buildQuestBoard([null, undefined], {}, MON).total).toBe(0);
  });
});
