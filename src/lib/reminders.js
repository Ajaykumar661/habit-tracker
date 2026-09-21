// Hands the reminder plan (domain/reminders.js) to the phone.
//
// The whole schedule is replaced every time: cancel what is pending, then
// schedule the fresh plan. That keeps the phone's queue an exact copy of the
// plan, so a day logged in the app can never still ring that evening.
//
// Only the Android / iOS app can schedule anything. A browser tab cannot
// wake itself up at 8PM, so on the web this reports itself unavailable and
// does nothing, rather than pretending.

import { Capacitor } from '@capacitor/core';
import { LocalNotifications as LN } from '@capacitor/local-notifications';

const CHANNEL = 'daily-reminder';

export function remindersAvailable() {
  return Capacitor.isNativePlatform();
}

/**
 * Ask for permission to notify. Only ever called from the user's own tap on
 * the switch, never on launch.
 * @returns {Promise<boolean>} whether reminders may be shown
 */
export async function requestReminderPermission() {
  if (!remindersAvailable()) return false;
  let { display } = await LN.checkPermissions();
  if (display !== 'granted') ({ display } = await LN.requestPermissions());
  return display === 'granted';
}

let channelReady = false;
async function ensureChannel() {
  if (channelReady || Capacitor.getPlatform() !== 'android') return;
  // Default importance: a sound and a place in the shade, no pop-over banner.
  await LN.createChannel({ id: CHANNEL, name: 'Daily reminder', description: 'One gentle reminder a day, only when something is still open.', importance: 3 });
  channelReady = true;
}

/** Replace whatever is pending with `plan`. An empty plan clears everything. */
export async function syncReminders(plan) {
  if (!remindersAvailable()) return;
  const { notifications: pending } = await LN.getPending();
  if (pending.length) await LN.cancel({ notifications: pending.map((n) => ({ id: n.id })) });
  if (!plan.length) return;

  // Permission can be withdrawn in system settings at any time; scheduling
  // without it would fail loudly, so check quietly and stand down.
  const { display } = await LN.checkPermissions();
  if (display !== 'granted') return;

  await ensureChannel();
  await LN.schedule({
    notifications: plan.map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: { at: r.at },
      // A daily nudge may land a few minutes late. Asking for exact alarms
      // would send the user to a system settings page, for nothing.
      isExactNotification: false,
      channelId: CHANNEL,
      smallIcon: 'ic_stat_tally',
      iconColor: '#E0A458',
    })),
  });
}
