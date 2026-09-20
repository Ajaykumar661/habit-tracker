import { motion, useAnimation, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import PixelIcon from './PixelIcon';
import { formatDateLabel } from '../lib/dates';

// One plaque on the wall.
//
// A locked plaque still says how far along it is, because a bar that is
// visibly filling is the point — a wall of anonymous padlocks tells you
// nothing. A hidden one keeps its name until it is earned.
export default function AchievementBadge({ achievement, achievedDate }) {
  const { unlocked, hidden, title, desc, pct, progressText } = achievement;
  const controls = useAnimation();
  const reducedMotion = useReducedMotion();
  const wasUnlocked = useRef(unlocked);

  useEffect(() => {
    if (unlocked && !wasUnlocked.current && !reducedMotion) {
      controls.start({ scale: [1, 1.12, 1], transition: { duration: 0.4 } });
    }
    wasUnlocked.current = unlocked;
  }, [unlocked, controls, reducedMotion]);

  const secret = hidden && !unlocked;
  const name = secret ? '???' : title;
  const blurb = secret ? 'A SECRET DEED' : desc;

  return (
    <motion.div
      className={'achievement-badge' + (unlocked ? ' unlocked' : '')}
      animate={controls}
      title={blurb}
      aria-label={`${name}: ${blurb}. ${unlocked ? 'Earned' : progressText}`}
    >
      <PixelIcon icon={secret ? 'lock' : achievement.icon} />
      {!unlocked && (
        <div className="achievement-lock-badge">
          <PixelIcon icon="lock" />
        </div>
      )}
      <div className="achievement-text">
        <span className="achievement-title">{name}</span>
        {unlocked && achievedDate ? (
          <span className="achievement-date">{formatDateLabel(achievedDate)}</span>
        ) : (
          <span className="achievement-days">{unlocked ? 'EARNED' : progressText}</span>
        )}
        {!unlocked && (
          <span className="achievement-bar" aria-hidden="true">
            <span className="achievement-bar-fill" style={{ width: `${pct}%` }} />
          </span>
        )}
      </div>
    </motion.div>
  );
}
