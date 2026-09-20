// Categorized quote pools + a context-aware picker. Kept as its own module
// (no component logic here) so the copy can grow independently of the UI.

export const QUOTES = {
  DAWN: [
    'Rise, adventurer. Thy streak awaits.',
    'The kingdom will not conquer itself.',
    'Another day. Another tally.',
    'The rooster has crowed. So must you.',
    'Dawn breaks. The wall is patient, but watching.',
  ],
  DAY: [
    'The sun favors those who show up.',
    'Somewhere in the kingdom, a scribe is recording this.',
    'The wall is warm today. Add to it.',
    'Midday. No excuses have been granted.',
    'The fields are tended. Tend to this too.',
  ],
  DUSK: [
    'The sun sets. The streak does not.',
    'Even the knights rest. Your streak does not.',
    'Torches are lit for those who finish what they started.',
    'The gates close soon. One more tally before dark.',
  ],
  NIGHT: [
    'The kingdom sleeps. You are still here.',
    'Under moonlight, another tally is earned.',
    'The wall glows faintly. It remembers everything.',
    'Even the owls are impressed.',
  ],

  // Generic, day-count-agnostic streak commentary — mixed in at random for
  // flavor on any day where nothing more specific applies.
  STREAK: [
    'Five days. The wall remembers.',
    'Ten days. At this point, it would be embarrassing to stop.',
    'Twenty days. The peasants are beginning to notice.',
    'The tally grows. So does the legend.',
    'Consistency turns intentions into reality.',
    'Another mark. The stone does not lie.',
  ],

  MILESTONE: [
    '30 days completed. The tavern speaks of your discipline.',
    '50 days. Surely this is witchcraft.',
    'A milestone, carved in stone, impossible to argue with.',
  ],

  MISSED_DAY: [
    'The wall remembers.',
    'An unfortunate tactical retreat.',
    'Your streak has fallen in battle.',
    'Even knights occasionally lose a duel.',
    'The chronicle shows a gap. Chronicles heal.',
  ],

  // Shown once, in the modal, when a run of real length has lapsed. These
  // carry the loss without scolding — the point is to get back on the wall.
  STREAK_LOST: [
    'A wall is not judged by one missing stone.',
    'The chronicle shows a gap. Chronicles are long; gaps are short.',
    'Every long run in this kingdom began the day after a shorter one ended.',
    'No knight went undefeated. They simply returned to the field.',
    'The stone that fell can be set again. Set it.',
    'The wall kept your record. It is waiting for the next one.',
    'Streaks end. Builders do not.',
  ],

  NEW_RECORD: [
    'A new record has been carved into the wall.',
    'The old mark has been surpassed. Let it be known.',
    'History has been rewritten, one tally at a time.',
  ],

  RANDOM: [
    'The wall waits for no one, yet it waited for you.',
    'Small stones build great halls.',
    'Discipline: the quietest form of rebellion.',
  ],

  FUNNY: [
    'Thou hast opened the app. Unfortunately, thou must now be productive.',
    'Your ancestors hunted mammoths. You can read 10 pages.',
    "Bro really said 'I'll start tomorrow.'",
    'Day 12. The intrusive thoughts have been defeated.',
    'One does not simply skip leg day.',
    'POV: You actually kept the streak.',
    'The council has reviewed your excuses. They have been rejected.',
    'Skill issue. Add the tally.',
    'Your streak is cooking.',
    'Me? Missing a day? In this economy?',
    'Imagine breaking a 27-day streak because you were feeling lazy.',
    'Touch grass. Then return and add your tally.',
    'Another day, another victory over your future self.',
  ],
};

// Exact-day flavor text — checked before anything else when the current
// streak matches one of these keys.
const DAY_EXACT = {
  0: ['Your wall awaits its first mark.'],
  1: ['The first stone has been laid.'],
  7: ['One week. The villagers are impressed.'],
  14: ['Two weeks. This is becoming suspicious.'],
  30: ['30 days. You have become the final boss.'],
  50: ['50 days. The streak now has its own reputation.'],
  100: ['100 days. Historians will argue about this.', '100 days. The kingdom officially considers you suspicious.'],
};

function randomFrom(pool) {
  return pool[Math.floor(Math.random() * pool.length)];
}

// ctx: { envState, currentStreak, missedYesterday, isNewRecord, justMilestone, excludeText }
export function pickQuote(ctx = {}) {
  const { envState = 'day', currentStreak = 0, missedYesterday, isNewRecord, justMilestone, excludeText } = ctx;

  let pool;
  if (missedYesterday) {
    pool = QUOTES.MISSED_DAY;
  } else if (isNewRecord && currentStreak > 0) {
    pool = QUOTES.NEW_RECORD;
  } else if (justMilestone) {
    pool = QUOTES.MILESTONE;
  } else if (DAY_EXACT[currentStreak]) {
    pool = DAY_EXACT[currentStreak];
  } else {
    const roll = Math.random();
    if (roll < 0.15) pool = QUOTES.FUNNY;
    else if (roll < 0.35 && currentStreak > 0) pool = QUOTES.STREAK;
    else pool = QUOTES[envState.toUpperCase()] || QUOTES.RANDOM;
  }

  if (pool.length > 1 && excludeText) {
    const filtered = pool.filter((q) => q !== excludeText);
    if (filtered.length) pool = filtered;
  }

  return randomFrom(pool);
}
