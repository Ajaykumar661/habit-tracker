import { memo } from 'react';
import { motion } from 'framer-motion';

// The RPG layer, as a small brass plaque in the ledger — not a profile page.
// Title and level lead; the XP bar is a thin carved channel beneath, because
// the number matters less than the sense of rank.
function LevelPlaque({ progression }) {
  if (!progression) return null;
  const { title, level, xp, xpIntoLevel, xpForNextLevel, progressPct, perfectDayCount } = progression;

  return (
    <div className="level-plaque" data-area="level">
      <div className="level-plaque-head">
        <span className="level-title">{title}</span>
        <span className="level-number">LV {level}</span>
      </div>

      <div
        className="level-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={xpForNextLevel}
        aria-valuenow={xpIntoLevel}
        aria-label={`Level ${level}, ${xpIntoLevel} of ${xpForNextLevel} experience to the next level`}
      >
        <motion.div
          className="level-bar-fill"
          initial={false}
          animate={{ width: `${progressPct}%` }}
          transition={{ type: 'spring', stiffness: 220, damping: 30 }}
        />
      </div>

      <div className="level-plaque-foot">
        <span>{xpIntoLevel.toLocaleString()} / {xpForNextLevel.toLocaleString()} XP</span>
        {perfectDayCount > 0 && <span className="level-perfect">{perfectDayCount} PERFECT</span>}
      </div>
      <div className="level-total">{xp.toLocaleString()} XP EARNED</div>
    </div>
  );
}

export default memo(LevelPlaque);
