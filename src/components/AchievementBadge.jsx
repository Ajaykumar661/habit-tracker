import { motion, useAnimation, useReducedMotion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import PixelIcon from './PixelIcon';
import { formatDateLabel } from '../lib/dates';

export default function AchievementBadge({ achievement, unlocked, achievedDate }) {
  const controls = useAnimation();
  const reducedMotion = useReducedMotion();
  const wasUnlocked = useRef(unlocked);

  useEffect(() => {
    if (unlocked && !wasUnlocked.current && !reducedMotion) {
      controls.start({ scale: [1, 1.12, 1], transition: { duration: 0.4 } });
    }
    wasUnlocked.current = unlocked;
  }, [unlocked, controls, reducedMotion]);

  return (
    <motion.div
      className={'achievement-badge' + (unlocked ? ' unlocked' : '')}
      animate={controls}
    >
      <PixelIcon icon={achievement.icon} />
      {!unlocked && (
        <div className="achievement-lock-badge">
          <PixelIcon icon="lock" />
        </div>
      )}
      <div className="achievement-text">
        <span className="achievement-title">{achievement.code}</span>
        <span className="achievement-days">{achievement.days} DAYS</span>
        {unlocked && achievedDate && (
          <span className="achievement-date">{formatDateLabel(achievedDate)}</span>
        )}
      </div>
    </motion.div>
  );
}
