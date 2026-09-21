import { motion, AnimatePresence } from 'framer-motion';
import Tray from './Tray';
import { useVoice } from '../hooks/useVoice';

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

export default function StatsPanel({ stats, progression }) {
  const v = useVoice();
  return (
    /* The streak rides on the handle so a retracted ledger still says the
       one number worth seeing at a glance. */
    <Tray area="stats" label={v.stats.title} count={`${stats.currentStreak}D`}>
      <dl className="stats-list">
        <StatRow label={v.stats.current} value={`${stats.currentStreak} DAYS`} />
        <StatRow label={v.stats.best} value={`${stats.bestStreak} DAYS`} />
        <StatRow label={v.stats.total} value={`${stats.totalCompleted}`} />
        <StatRow label={v.stats.completion} value={`${stats.completionPct}%`} />
        <StatRow label={v.stats.missed} value={`${stats.missedDays}`} />
        <StatRow label={v.stats.tracked} value={`${stats.daysSinceStart}`} />
        <StatRow label={v.stats.shields} value={`${stats.shields?.available ?? 0}`} />
        {progression?.perfect && (
          <StatRow label={v.stats.perfect} value={`${progression.perfect.total}`} />
        )}
      </dl>
    </Tray>
  );
}
