import { motion, AnimatePresence } from 'framer-motion';
import PixelIcon from './PixelIcon';

export default function AchievementPopup({ achievement }) {
  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          className="achievement-popup"
          style={{ x: '-50%' }}
          initial={{ y: -60, opacity: 0, scale: 0.6, rotate: -6 }}
          animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
          exit={{ y: -40, opacity: 0, scale: 0.7 }}
          transition={{ type: 'spring', stiffness: 400, damping: 14 }}
        >
          <motion.div
            className="achievement-popup-inner pixel-panel"
            animate={{ scale: [1, 1.06, 1] }}
            transition={{ duration: 1.4, repeat: 1, repeatType: 'reverse' }}
          >
            <div className="achievement-popup-label">ACHIEVEMENT UNLOCKED</div>
            <motion.div
              className="achievement-icon-slot"
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 10, delay: 0.15 }}
            >
              <PixelIcon icon={achievement.icon} />
            </motion.div>
            <div className="achievement-popup-title">{achievement.code}</div>
            <div className="achievement-popup-days">{achievement.days} DAYS</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
