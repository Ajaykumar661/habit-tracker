import { motion, useReducedMotion } from 'framer-motion';
import { recoveryMessage } from '../domain/recovery';

// The rally: a short, winnable goal offered in the days after a break.
//
// It sits above the action buttons because that is where the eye already is
// when deciding whether to mark today. It never appears unless the domain
// layer says a rally is genuinely underway, and it says nothing about what
// was lost — the streak modal already did that, once.
export default function RallyStrip({ recovery }) {
  const reducedMotion = useReducedMotion();
  if (!recovery?.active) return null;

  const line = recoveryMessage(recovery);
  const pips = Array.from({ length: recovery.goal }, (_, i) => i < recovery.daysBack);

  return (
    <motion.div
      className={`rally${recovery.complete ? ' won' : ''}`}
      role="status"
      initial={reducedMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <span className="rally-label">THE RALLY</span>
      <span className="rally-pips" aria-hidden="true">
        {pips.map((lit, i) => (
          <span key={i} className={`rally-pip${lit ? ' lit' : ''}`} />
        ))}
      </span>
      <span className="rally-line">{line}</span>
    </motion.div>
  );
}
