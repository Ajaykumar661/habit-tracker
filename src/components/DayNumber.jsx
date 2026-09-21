import { motion, AnimatePresence } from 'framer-motion';
import { useVoice } from '../hooks/useVoice';

// The wall itself should communicate the streak before this is even read --
// so this is a small block beside the action, not a banner above it. Once
// today is logged it tints and says so, which is why the action beside it
// can shrink to a quiet undo.
export default function DayNumber({ stats, doneToday }) {
  const v = useVoice();
  return (
    <div className={`day-block${doneToday ? ' done' : ''}`} aria-label={`Day ${stats.currentStreak}`}>
      <span className="day-caption">DAY</span>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={stats.currentStreak}
          className="day-counter"
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          {stats.currentStreak}
        </motion.span>
      </AnimatePresence>
      <span className="day-status">{doneToday ? v.action.doneShort : ' '}</span>
    </div>
  );
}
