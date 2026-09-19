import { motion, AnimatePresence } from 'framer-motion';

// The wall itself should communicate the streak before this is even read —
// kept present but intentionally less dominant than the tally marks.
export default function DayNumber({ stats }) {
  return (
    <div className="wall-stats-strip">
      <AnimatePresence mode="wait">
        <motion.div
          key={stats.currentStreak}
          className="day-counter"
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18 }}
        >
          DAY {stats.currentStreak}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
