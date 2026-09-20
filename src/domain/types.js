// Domain types for Tally Wall.
//
// This project is plain JS by choice (no TypeScript toolchain), so the model
// is described with JSDoc typedefs instead: editors get real completion and
// checking, and the build stays exactly as it is.
//
// The shape deliberately separates *what you intend to do* (Habit) from
// *what happened* (Completion), so history stays truthful when a habit is
// later renamed, rescheduled or archived.

/**
 * How a habit is judged complete for a day.
 *  - boolean   done / not done
 *  - count     value >= target        (glasses of water)
 *  - duration  seconds >= target      (time studied)
 *  - numeric   value >= target        (pages read)
 * @typedef {'boolean' | 'count' | 'duration' | 'numeric'} HabitType
 */

/** @typedef {'easy' | 'normal' | 'hard'} Difficulty */

/**
 * Which days a habit is expected on. `weekdays` uses JS getDay(): 0=Sunday.
 * For 'daily' it is ignored; for 'weekly' an empty list means "no scheduled
 * days", which the engines treat as never-due rather than always-due.
 * @typedef {Object} Schedule
 * @property {'daily' | 'weekly'} frequency
 * @property {number[]} [weekdays]
 */

/**
 * @typedef {Object} Habit
 * @property {string}     id
 * @property {string}     name
 * @property {HabitType}  type
 * @property {Schedule}   schedule
 * @property {number}     [target]      required for count/duration/numeric
 * @property {string}     [unit]        'glasses', 'pages', 'minutes'…
 * @property {Difficulty} difficulty
 * @property {string}     startDate     first day this habit counts from (local YYYY-MM-DD)
 * @property {string}     createdAt     ISO timestamp
 * @property {string|null} archivedAt   ISO timestamp, or null while active
 * @property {number[]}   seenMilestones  streak lengths already celebrated
 * @property {string|null} mournedStreakEnd  end date of a break already acknowledged
 * @property {string|null} acknowledgedShield  date of the last shield spend already shown
 * @property {Record<string,string>} breakReasons  run's last day -> user's reason
 */

/**
 * One habit on one day. Absence of a record means "nothing logged", which is
 * distinct from a record with completed:false (explicitly not done).
 * @typedef {Object} Completion
 * @property {string}  id
 * @property {string}  habitId
 * @property {string}  date          local YYYY-MM-DD (see lib/dates)
 * @property {boolean} completed     the engine's verdict for this day
 * @property {number}  [value]       count / seconds / numeric amount
 * @property {string}  [note]
 * @property {string}  [completedAt] ISO timestamp of when it was logged
 */

/**
 * Completions are stored nested rather than as a flat array: lookup for
 * "this habit on this day" is the single hottest read in the app (the wall,
 * the calendar and every streak calculation do it), and nesting makes a
 * duplicate record for the same habit/day structurally impossible. Export
 * flattens it back to an array.
 * @typedef {Record<string, Record<string, Completion>>} CompletionIndex
 */

/**
 * @typedef {Object} Settings
 * @property {number} dayCutoffHour  0-6; hours past midnight still counted as
 *                                   the previous day (see Phase 22)
 */

/**
 * @typedef {Object} AppState
 * @property {number}          schemaVersion
 * @property {Habit[]}         habits
 * @property {CompletionIndex} completions
 * @property {string|null}     activeHabitId
 * @property {Settings}        settings
 */

export {};
