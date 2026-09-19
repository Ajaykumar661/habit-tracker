import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import { forwardRef, useEffect, useRef } from 'react';

const MarkButton = forwardRef(function MarkButton({ doneToday, onClick }, ref) {
  const controls = useAnimation();
  const reducedMotion = useReducedMotion();
  const wasDone = useRef(doneToday);

  useEffect(() => {
    // Pulse once, only on the locked->done transition — not on every
    // unrelated re-render (that was the old bug: a keyframe array in
    // `animate` replays whenever the parent re-renders).
    if (doneToday && !wasDone.current && !reducedMotion) {
      controls.start({ scale: [1, 1.15, 1], transition: { duration: 0.35 } });
    }
    wasDone.current = doneToday;
  }, [doneToday, controls, reducedMotion]);

  return (
    <motion.button
      ref={ref}
      type="button"
      className={'pixel-btn pixel-btn-big' + (doneToday ? ' btn-complete-state' : '')}
      disabled={doneToday}
      onClick={onClick}
      animate={controls}
      whileHover={doneToday ? undefined : { y: -2, filter: 'brightness(1.1)' }}
      whileTap={doneToday ? undefined : { scale: 0.9, y: 1 }}
    >
      {doneToday ? 'TODAY COMPLETE' : '+ MARK TODAY COMPLETE'}
    </motion.button>
  );
});

export default function ActionButtons({ doneToday, onMarkToday, onUndo, markBtnRef }) {
  return (
    <div className="wall-actions">
      <MarkButton ref={markBtnRef} doneToday={doneToday} onClick={onMarkToday} />
      <AnimatePresence>
        {doneToday && (
          <motion.button
            type="button"
            className="pixel-btn pixel-btn-danger"
            onClick={onUndo}
            initial={{ opacity: 0, scale: 0.7, x: -10 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            exit={{ opacity: 0, scale: 0.7, x: -10 }}
            whileHover={{ filter: 'brightness(1.1)' }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 500, damping: 24 }}
          >
            UNDO TALLY
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
