import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { getStreakHistory, BREAK_REASONS } from '../domain/history';
import { formatDateLabel } from '../lib/dates';
import { useVoice } from '../hooks/useVoice';

// The runs that came before, as entries in a ledger.
//
// A broken run can carry a reason, but only one the user chose — the app
// never infers it. It is offered quietly, on the expanded row, so the
// chronicle can hold context without turning into a form to fill in.

function StreakRow({ streak, expanded, onToggle, onSetReason }) {
  const v = useVoice();
  const reducedMotion = useReducedMotion();
  const id = `${streak.start}-${streak.end}`;

  return (
    <li className={`streak-row${streak.live ? ' live' : ''}`}>
      <button
        type="button"
        className="streak-head"
        onClick={() => onToggle(id)}
        aria-expanded={expanded}
      >
        <span className="streak-days">{streak.days}</span>
        <span className="streak-unit">{streak.days === 1 ? 'DAY' : 'DAYS'}</span>
        <span className="streak-when">
          {streak.live ? 'CURRENT' : formatDateLabel(streak.end)}
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            className="streak-detail"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={reducedMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="streak-range">
              {formatDateLabel(streak.start)} &rarr; {formatDateLabel(streak.end)}
            </div>

            {!streak.live && (
              <>
                <div className="streak-broken">{v.history.broken} {formatDateLabel(streak.brokenOn)}</div>
                <div className="streak-reason-label">
                  {streak.reason ? v.history.reason : v.history.ask}
                </div>
                <div className="streak-reasons">
                  {BREAK_REASONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className={`choice-btn${streak.reason === r.id ? ' active' : ''}`}
                      onClick={() => onSetReason(streak.end, streak.reason === r.id ? null : r.id)}
                      aria-pressed={streak.reason === r.id}
                    >
                      {v.history.reasons[r.id]}
                    </button>
                  ))}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

export default function StreakHistory({ routine, today, onSetReason }) {
  const v = useVoice();
  const [expanded, setExpanded] = useState(null);
  const history = getStreakHistory(routine, today);

  if (!history.length) {
    return (
      <div className="streak-history">
        <h3 className="bar-log-title">{v.history.title}</h3>
        <p className="bar-log-empty">NO RUNS RECORDED YET.</p>
      </div>
    );
  }

  return (
    <div className="streak-history">
      <h3 className="bar-log-title">{v.history.title}</h3>
      <ul className="streak-list">
        {history.map((s) => {
          const id = `${s.start}-${s.end}`;
          return (
            <StreakRow
              key={id}
              streak={s}
              expanded={expanded === id}
              onToggle={(x) => setExpanded((cur) => (cur === x ? null : x))}
              onSetReason={onSetReason}
            />
          );
        })}
      </ul>
      {history.some((s) => s.reason) && (
        <p className="streak-reason-note">
          {v.history.summary(
            history.filter((s) => s.reason).length,
            [...new Set(history.filter((s) => s.reason).map((s) => v.history.reasons[s.reason]))].join(', '),
          )}
        </p>
      )}
    </div>
  );
}
