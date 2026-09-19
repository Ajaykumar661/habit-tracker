import { motion, AnimatePresence } from 'framer-motion';

function StatRow({ label, value }) {
  return (
    <div className="stat-row">
      <dt>{label}</dt>
      <AnimatePresence mode="wait">
        <motion.dd
          key={value}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 22 }}
        >
          {value}
        </motion.dd>
      </AnimatePresence>
    </div>
  );
}

export default function StatsPanel({ stats }) {
  return (
    <div data-area="stats">
      <h2 className="panel-title">RECORD</h2>
      <dl className="stats-list">
        <StatRow label="CURRENT STREAK" value={`${stats.currentStreak} DAYS`} />
        <StatRow label="LONGEST SENTENCE" value={`${stats.bestStreak} DAYS`} />
        <StatRow label="TOTAL TALLIES" value={`${stats.totalCompleted}`} />
        <StatRow label="COMPLETION" value={`${stats.completionPct}%`} />
        <StatRow label="MISSED DAYS" value={`${stats.missedDays}`} />
        <StatRow label="DAYS TRACKED" value={`${stats.daysSinceStart}`} />
      </dl>
    </div>
  );
}
