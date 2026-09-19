import { motion } from 'framer-motion';

export default function BarLog({ stats }) {
  const activeDates = stats.currentSegment ? stats.currentSegment.dates : [];

  if (activeDates.length === 0) {
    return <p className="bar-log-empty">NO TALLIES IN CURRENT SENTENCE YET.</p>;
  }

  const recent = [...activeDates].reverse().slice(0, 12);
  const maxN = activeDates.length;

  return (
    <div className="bar-log-rows">
      {recent.map((dateStr, idx) => {
        const dayNumber = maxN - idx;
        const pct = Math.max(8, Math.round((dayNumber / Math.max(maxN, 1)) * 100));
        return (
          <div className="bar-row" key={dateStr} title={dateStr}>
            <span className="bar-day-label">DAY {dayNumber}</span>
            <div className="bar-track">
              <motion.div
                className="bar-fill"
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
