// Looking after a record that only exists in one place.
//
// Tally Wall keeps everything on the device and sends it nowhere. That is
// the point, and it is also the risk: a lost phone takes the chronicle with
// it, and there is no server to restore from. Nobody thinks about backups
// until the week after they needed one.
//
// So the app keeps track of when a copy was last saved and says so — once
// there is enough history to be worth protecting, and quietly enough that
// it never becomes something to dismiss reflexively.

import { earliestStart } from './perfectDays';
import { habitToday, diffDays, toDateStr } from '../lib/dates';

export const BACKUP_RULES = {
  /** Don't mention backups until the record is worth this many days. */
  minDaysTracked: 14,
  /** A copy older than this is worth a gentle word. */
  staleAfterDays: 30,
};

/**
 * @returns {{
 *   tracked: number, lastSaved: string|null, daysSince: number|null,
 *   neverSaved: boolean, overdue: boolean, label: string,
 * }}
 */
export function backupStatus(habits, settings, today = habitToday()) {
  const active = (habits || []).filter(Boolean);
  const start = earliestStart(active);
  const tracked = start && start <= today ? diffDays(today, start) + 1 : 0;

  const raw = settings?.lastExportAt || null;
  let daysSince = null;
  if (raw) {
    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
      daysSince = Math.max(0, diffDays(today, toDateStr(parsed)));
    }
  }

  const neverSaved = daysSince === null;
  const worthProtecting = tracked >= BACKUP_RULES.minDaysTracked;
  const stale = daysSince !== null && daysSince >= BACKUP_RULES.staleAfterDays;

  return {
    tracked,
    lastSaved: raw,
    daysSince,
    neverSaved,
    // Only nag about a record long enough to hurt to lose.
    overdue: worthProtecting && (neverSaved || stale),
    label: describe(daysSince, neverSaved),
  };
}

function describe(daysSince, neverSaved) {
  if (neverSaved) return 'NO COPY SAVED YET';
  if (daysSince === 0) return 'SAVED TODAY';
  if (daysSince === 1) return 'SAVED YESTERDAY';
  return `SAVED ${daysSince} DAYS AGO`;
}
