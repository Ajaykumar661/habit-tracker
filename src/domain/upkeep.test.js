import { describe, it, expect } from 'vitest';
import { createHabit } from './schema';
import { backupStatus, BACKUP_RULES } from './upkeep';

const TODAY = '2026-09-21';
const mk = (start) => createHabit({ id: 'h', startDate: start });
const daysAgo = (n) => {
  const d = new Date(`${TODAY}T12:00:00`);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

describe('backup status', () => {
  it('counts the days of record it is protecting', () => {
    expect(backupStatus([mk('2026-09-01')], {}, TODAY).tracked).toBe(21);
  });

  it('stays quiet about a record too young to matter', () => {
    const s = backupStatus([mk('2026-09-19')], {}, TODAY);
    expect(s.tracked).toBeLessThan(BACKUP_RULES.minDaysTracked);
    expect(s.overdue).toBe(false);
  });

  it('speaks up once there is a record worth losing and no copy', () => {
    const s = backupStatus([mk('2026-08-01')], {}, TODAY);
    expect(s.neverSaved).toBe(true);
    expect(s.overdue).toBe(true);
    expect(s.label).toBe('NO COPY SAVED YET');
  });

  it('says nothing while a copy is recent', () => {
    const s = backupStatus([mk('2026-08-01')], { lastExportAt: daysAgo(3) }, TODAY);
    expect(s.daysSince).toBe(3);
    expect(s.overdue).toBe(false);
    expect(s.label).toBe('SAVED 3 DAYS AGO');
  });

  it('speaks up again once the copy goes stale', () => {
    const s = backupStatus([mk('2026-06-01')], { lastExportAt: daysAgo(40) }, TODAY);
    expect(s.overdue).toBe(true);
    expect(s.label).toBe('SAVED 40 DAYS AGO');
  });

  it('reads the day it was saved plainly', () => {
    expect(backupStatus([mk('2026-08-01')], { lastExportAt: daysAgo(0) }, TODAY).label)
      .toBe('SAVED TODAY');
    expect(backupStatus([mk('2026-08-01')], { lastExportAt: daysAgo(1) }, TODAY).label)
      .toBe('SAVED YESTERDAY');
  });

  it('treats an unreadable timestamp as no copy at all', () => {
    const s = backupStatus([mk('2026-08-01')], { lastExportAt: 'not a date' }, TODAY);
    expect(s.neverSaved).toBe(true);
  });

  it('handles having no habits yet', () => {
    const s = backupStatus([], {}, TODAY);
    expect(s.tracked).toBe(0);
    expect(s.overdue).toBe(false);
  });

  it('handles a habit that has not started yet', () => {
    expect(backupStatus([mk('2099-01-01')], {}, TODAY).tracked).toBe(0);
  });
});
