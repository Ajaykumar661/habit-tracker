// The Warden's Guide: what everything on the screen means.
//
// Kept as data rather than markup so the pages can be counted, tested and
// reordered without touching the component, and so the writing sits in one
// place where its tone can be judged as a whole.
//
// Two rules for the writing:
//
//   1. Every page names a thing the reader can actually see on screen, and
//      says what it does. Atmosphere is welcome; atmosphere in place of an
//      explanation is not — a new user must leave knowing how to use this.
//   2. Nothing promises a feature that does not exist. This file is read by
//      someone deciding whether to trust the app with a year of their life.

/**
 * @typedef {Object} GuidePage
 * @property {string} id
 * @property {string} title    Heading, in the app's voice.
 * @property {string} icon     A key from ICON_BITMAPS.
 * @property {string} lead     One sentence naming the thing.
 * @property {string[]} points What it does, plainly.
 */

/** @type {GuidePage[]} */
export const GUIDE_PAGES = [
  {
    id: 'wall',
    title: 'THE WALL',
    icon: 'calendar',
    lead: 'The stone wall in the centre is your record.',
    points: [
      'Every day you keep is cut into it as a tally mark.',
      'Marks are grouped in fives, so a long run is countable at a glance.',
      'Press MARK TODAY COMPLETE below the wall to cut today’s mark.',
      'Pressed it by mistake? UNDO TALLY takes it straight back.',
    ],
  },
  {
    id: 'quests',
    title: 'TODAY’S QUEST',
    icon: 'key',
    lead: 'The board on the left lists everything you are tracking.',
    points: [
      'Tap the box beside a quest to log it without leaving the wall you are on.',
      'Tap its name to bring that quest’s wall to the centre.',
      'A quest can be a yes or no, or ask for a count — eight glasses of water, thirty minutes of reading.',
      'Quests can run every day or only on chosen weekdays. A rest day is never counted as missed.',
    ],
  },
  {
    id: 'streak',
    title: 'STREAKS AND SHIELDS',
    icon: 'shield',
    lead: 'A streak is the run of days in a row that you kept a quest.',
    points: [
      'Only days the quest was actually due can break it — skipping a rest day costs nothing.',
      'At 7, 30 and 100 days you earn a shield. You can hold three.',
      'A shield spends itself automatically to cover one missed day and hold the run together.',
      'When a run does end, the app says so once, plainly, and keeps your longest in view.',
    ],
  },
  {
    id: 'rally',
    title: 'THE RALLY',
    icon: 'shield',
    lead: 'What happens after a streak breaks.',
    points: [
      'Return for three days and the rally is won.',
      'It appears above the action buttons, with a pip for each day back.',
      'It only shows after a run worth mourning, and it fades once the break is old news.',
      'It exists because zero is a discouraging place to stand, and the work that built the run was still real.',
    ],
  },
  {
    id: 'progress',
    title: 'RANK AND RENOWN',
    icon: 'crown',
    lead: 'The plaque at the top right tracks how far you have come.',
    points: [
      'Completing a quest earns XP — more for one you marked as hard.',
      'Finishing everything due on a day is a perfect day, and worth a bonus.',
      'Enough XP raises your level and, in time, your title: Apprentice, Squire, Knight, and beyond.',
      'XP is counted from your record every time it is shown, so it can never drift out of step with what you actually did.',
    ],
  },
  {
    id: 'panels',
    title: 'THE LEDGER',
    icon: 'star',
    lead: 'The panels on the right each fold away — tap a heading to open or close it.',
    points: [
      'RECORD holds your streaks, totals and completion rate.',
      'ACHIEVEMENTS shows fifteen deeds. Locked ones still show how close you are.',
      'KINGDOM REPORT sums up your week and names patterns, once there is enough history to mean anything.',
      'On a phone, find these under the Records tab.',
    ],
  },
  {
    id: 'room',
    title: 'THE ROOM THAT GROWS',
    icon: 'crown',
    lead: 'The trophy shelf above the wall fills as your best run grows.',
    points: [
      'A new trophy is earned at 7, 14, 30, 60, 100 and 365 days. Dark shapes on the shelf are the ones still to come.',
      'Trophies are kept for good: a broken streak never takes one back.',
      'Tap any trophy to see what it is and what earned it. THE ROOM in the Records panel shows the whole set.',
      'Tap the sleeping cat to wake her. At 30 days she gets a cushion, and at 100, a crown.',
      'The room follows the seasons: petals, leaves or snow drift past, with something set out for the time of year.',
    ],
  },
  {
    id: 'extras',
    title: 'REMINDERS AND SHARING',
    icon: 'star',
    lead: 'A few things that live outside the wall itself.',
    points: [
      'In the Android app, settings can send one reminder a day, at the hour you pick, only if a quest is still open.',
      'It names what is left — 3 of 8 glasses, say — and stays quiet once your mark is made.',
      'The Android app also has a home screen widget with your streak and today’s progress. Add it from settings.',
      'SHARE MY WALL, under THE ROOM, turns your wall into a picture to send or post. Nothing leaves unless you share it.',
    ],
  },
  {
    id: 'chronicle',
    title: 'THE CHRONICLE',
    icon: 'calendar',
    lead: 'Scroll down, or use the Calendar tab, to look back.',
    points: [
      'Tap any day to see what was kept and what was missed.',
      'You can fill in a day you forgot to mark, or write a note about it.',
      'Below the calendar, every past run is listed — and you can record why one ended.',
      'Nothing here judges you. It is a record, not a report card.',
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
      'The gear holds sound, music, reminders, text size, backups, your world — keep or neon city — and when your day turns over.',
      'You can reopen this guide from settings whenever you like.',
    ],
  },
];

/** Roman numerals, for the page marker. Only ever needs to count pages. */
export function roman(n) {
  const table = [
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
  ];
  let out = '';
  let left = n;
  for (const [value, glyph] of table) {
    while (left >= value) {
      out += glyph;
      left -= value;
    }
  }
  return out;
}
