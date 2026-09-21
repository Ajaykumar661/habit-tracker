// Neon City's quote pools. Same keys and the same job as quotes.js -- dry,
// encouraging, occasionally silly -- in the voice of a rain-soaked city that
// runs all night. pickQuote() in quotes.js takes this set as its second
// argument.

export const NEON_QUOTES = {
  DAWN: [
    'Systems waking up. So are you.',
    'Sunrise over the grid. Log in.',
    'The night shift ends. Yours begins.',
    'The neon fades. The habit stays on.',
    'First light, first log.',
  ],
  DAY: [
    'Daylight mode. The streak keeps running.',
    'Uptime is a choice you make every day.',
    'The city never idles. Neither do you.',
    'Midday. No excuses in the queue.',
    'Traffic is heavy. Your streak is not stuck in it.',
  ],
  DUSK: [
    'The signs flicker on. So does your resolve.',
    'The sun logs off. The streak stays online.',
    'Rush hour. One more log before dark.',
    'The skyline lights up for those who finish.',
  ],
  NIGHT: [
    'The city sleeps in neon. You are still here.',
    'Rain on the glass. Another log in the system.',
    'The wall hums quietly. It remembers everything.',
    'Even the drones are impressed.',
  ],

  STREAK: [
    'Five days. The system remembers.',
    'Ten days. Stopping now would be a bug.',
    'Twenty days. The network is starting to notice.',
    'The count climbs. So does the signal.',
    'Consistency compiles intentions into reality.',
    'Another log. The data does not lie.',
  ],

  MILESTONE: [
    '30 days online. The city talks about your uptime.',
    '50 days. Surely this is an exploit.',
    'A milestone, written to disk. Impossible to argue with.',
  ],

  MISSED_DAY: [
    'The system remembers.',
    'Packet dropped. Reconnecting.',
    'Your streak hit a firewall.',
    'Even the best rigs crash sometimes.',
    'The log shows a gap. Logs recover.',
  ],

  // Shown once, when a run of real length has dropped. Carries the loss
  // without scolding -- the point is to get back online.
  STREAK_LOST: [
    'One dropped packet does not end a connection.',
    'The log shows a gap. Logs are long; gaps are short.',
    'Every long run in this city began the day after a shorter one ended.',
    'No runner goes undefeated. They just jack back in.',
    'The system restored from backup. Restore yourself.',
    'The wall kept your record. It is waiting for the next one.',
    'Streaks end. Builders reboot.',
  ],

  NEW_RECORD: [
    'New high score written to the wall.',
    'Old record overwritten. Let the city know.',
    'History rewritten, one log at a time.',
  ],

  RANDOM: [
    'The wall waits for no one, yet it waited for you.',
    'Small commits build big systems.',
    'Discipline: the quietest form of hacking.',
  ],

  FUNNY: [
    'You opened the app. Unfortunately, you must now be productive.',
    'Your ancestors hunted mammoths. You can read 10 pages.',
    "Bro really said 'I'll start tomorrow.'",
    'Day 12. The intrusive thoughts have been firewalled.',
    'One does not simply skip leg day.',
    'POV: You actually kept the streak.',
    'The algorithm reviewed your excuses. Rejected.',
    'Skill issue. Log it.',
    'Your streak is overclocked.',
    'Me? Missing a day? In this economy?',
    'Imagine breaking a 27-day streak because the Wi-Fi was slow.',
    'Touch grass. Then come back and log it.',
    'Another day, another patch for your future self.',
  ],
};

export const NEON_DAY_EXACT = {
  0: ['The wall is blank. Write the first line.'],
  1: ['First log saved.'],
  7: ['One week online. The drones are impressed.'],
  14: ['Two weeks. This is becoming suspicious.'],
  30: ['30 days. You are the final boss of this district.'],
  50: ['50 days. The streak now has its own fan club.'],
  100: ['100 days. The city archives are arguing about this.',
    '100 days. Corporate security now considers you suspicious.'],
};

export const NEON_QUOTE_SET = { pools: NEON_QUOTES, exact: NEON_DAY_EXACT };
