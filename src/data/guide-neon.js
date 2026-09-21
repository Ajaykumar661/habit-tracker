// The Operator's Manual: Neon City's guide. The same topics as the
// Warden's Guide (guide.js), in the same order, told in the city's words --
// so switching theme never changes what a new user learns, only how it is
// said. The same two rules apply: every page names something on screen and
// says what it does, and nothing promises a feature that does not exist.

/** @type {import('./guide').GuidePage[]} */
export const NEON_GUIDE_PAGES = [
  {
    id: 'wall',
    title: 'THE WALL',
    icon: 'calendar',
    lead: 'The concrete wall in the centre is your record.',
    points: [
      'Every day you complete is logged on it as a mark.',
      'Marks are grouped in fives, so a long run is countable at a glance.',
      'Press LOG TODAY below the wall to add today’s mark.',
      'Pressed it by mistake? UNDO LOG takes it straight back.',
    ],
  },
  {
    id: 'quests',
    title: 'TODAY’S MISSIONS',
    icon: 'key',
    lead: 'The panel on the left lists everything you are running.',
    points: [
      'Tap the box beside a mission to log it without leaving the wall you are on.',
      'Tap its name to bring that mission’s wall to the centre.',
      'A mission can be a yes or no, or ask for a count — eight glasses of water, thirty minutes of reading.',
      'Missions can run every day or only on chosen weekdays. A day off is never counted as missed.',
    ],
  },
  {
    id: 'streak',
    title: 'STREAKS AND FIREWALLS',
    icon: 'shield',
    lead: 'A streak is the run of days in a row you completed a mission.',
    points: [
      'Only days the mission was actually due can break it — a day off costs nothing.',
      'At 7, 30 and 100 days you earn a firewall. You can hold three.',
      'A firewall deploys itself to cover one missed day and keep the streak alive.',
      'When a run does drop, the app says so once, plainly, and keeps your best in view.',
    ],
  },
  {
    id: 'rally',
    title: 'THE REBOOT',
    icon: 'shield',
    lead: 'What happens after a streak drops.',
    points: [
      'Log three days back and the reboot is complete.',
      'It appears above the action buttons, with a light for each day back.',
      'It only shows after a run worth losing, and clears once the drop is old news.',
      'It exists because zero is a discouraging place to restart, and the work that built the run was still real.',
    ],
  },
  {
    id: 'progress',
    title: 'RANK AND REP',
    icon: 'crown',
    lead: 'The plate at the top right tracks how far you have come.',
    points: [
      'Completing a mission earns XP — more for one you marked as hard.',
      'Finishing everything due on a day is a flawless day, and worth a bonus.',
      'Enough XP raises your level and, in time, your rank: Rookie, Runner, Netrunner, and beyond.',
      'XP is counted from your record every time it is shown, so it can never drift out of step with what you actually did.',
    ],
  },
  {
    id: 'panels',
    title: 'THE DASHBOARD',
    icon: 'star',
    lead: 'The panels on the right each fold away — tap a heading to open or close it.',
    points: [
      'STATS holds your streaks, totals and completion rate.',
      'UNLOCKS shows fifteen of them. Locked ones still show how close you are.',
      'CITY REPORT sums up your week and spots patterns, once there is enough data to mean anything.',
      'On a phone, find these under the Stats tab.',
    ],
  },
  {
    id: 'room',
    title: 'THE HIDEOUT',
    icon: 'crown',
    lead: 'The shelf along the top of the wall fills as your best run grows.',
    points: [
      'A new unlock lands at 7, 14, 30, 60, 100 and 365 days. Dark outlines on the shelf are the ones still to come.',
      'Unlocks are kept for good: a dropped streak never takes one back.',
      'Tap any unlock to see what it is and what earned it. THE HIDEOUT in the Stats panel shows the whole set.',
      'Tap the sleeping cat to wake her. At 30 days she gets a pod, and at 100, a visor.',
      'The city follows the seasons: petals, leaves or snow drift past, with a seasonal mod set out.',
    ],
  },
  {
    id: 'extras',
    title: 'PINGS AND SHARING',
    icon: 'star',
    lead: 'A few things that run outside the wall itself.',
    points: [
      'In the Android app, settings can send one ping a day, at the time you set, only if a mission is still pending.',
      'It names what is left — 3 of 8 glasses, say — and goes quiet once you log.',
      'The Android app also has a home screen widget with your streak and today’s progress. Add it from settings.',
      'SHARE MY WALL, under THE HIDEOUT, turns your wall into a picture to send or post. Nothing leaves unless you share it.',
    ],
  },
  {
    id: 'chronicle',
    title: 'THE LOGBOOK',
    icon: 'calendar',
    lead: 'Scroll down, or use the Logbook tab, to look back.',
    points: [
      'Tap any day to see what was done and what was missed.',
      'You can fill in a day you forgot to log, or leave a note on it.',
      'Below the calendar, every past run is listed — and you can record why one dropped.',
      'Nothing here judges you. It is a record, not a performance review.',
    ],
  },
  {
    id: 'yours',
    title: 'IT IS ALL YOURS',
    icon: 'lock',
    lead: 'Tally Wall keeps everything on this device.',
    points: [
      'No account, no server, no tracking. It works with no connection at all.',
      'That also means nobody else holds a copy — so use EXPORT in settings and keep the file somewhere safe.',
      'The gear holds sound, music, pings, text size, backups, your choice of world, and when your day resets.',
      'You can reopen this manual from settings whenever you like.',
    ],
  },
];
