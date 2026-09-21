import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'framer-motion';
import { forwardRef, useEffect, useRef } from 'react';
import { progressOf, stepFor, isMeasuredType, formatDuration, SECONDS_PER_MINUTE } from '../domain/completion';
import { useVoice } from '../hooks/useVoice';

const MarkButton = forwardRef(function MarkButton({ doneToday, onClick, label }, ref) {
  const controls = useAnimation();
  const reducedMotion = useReducedMotion();
  const wasDone = useRef(doneToday);

  useEffect(() => {
    // Pulse once, only on the locked->done transition — not on every
    // unrelated re-render.
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
      <span className="label-full">{label.full}</span>
      <span className="label-compact">{label.compact}</span>
    </motion.button>
  );
});

/**
 * A measured habit is logged by filling a bar rather than flipping a switch.
 * The bar is carved into the same wooden plaque as everything else — the
 * point is that progress is a physical thing on the wall, not a widget.
 */
function ProgressCounter({ routine, record, onAdd, markBtnRef }) {
  const { value, target, pct, complete, text } = progressOf(routine, record);
  const step = stepFor(routine);
  const stepLabel = routine.type === 'duration'
    ? `${Math.round(step / SECONDS_PER_MINUTE)}M`
    : `${step}`;

  return (
    <div className={`quest-counter${complete ? ' complete' : ''}`}>
      <div className="quest-counter-head">
        <span className="quest-counter-value">{text}</span>
        {routine.unit && routine.type !== 'duration' && (
          <span className="quest-counter-unit">{routine.unit}</span>
        )}
      </div>

      <div
        className="quest-bar"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={value}
        aria-label={`${routine.name}: ${routine.type === 'duration' ? formatDuration(value) : value} of ${routine.type === 'duration' ? formatDuration(target) : target}`}
      >
        <motion.div
          className="quest-bar-fill"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', stiffness: 260, damping: 28 }}
        />
      </div>

      <div className="quest-counter-actions">
        <button
          type="button"
          className="pixel-btn pixel-btn-small quest-step"
          onClick={() => onAdd(-step)}
          disabled={value <= 0}
          aria-label={`Remove ${stepLabel}`}
        >
          −{stepLabel}
        </button>
        <motion.button
          ref={markBtnRef}
          type="button"
          className="pixel-btn pixel-btn-small quest-step add"
          onClick={() => onAdd(step)}
          whileTap={{ scale: 0.92 }}
          aria-label={`Add ${stepLabel}`}
        >
          +{stepLabel}
        </motion.button>
      </div>
    </div>
  );
}

export default function ActionButtons({ routine, record, doneToday, onMarkToday, onAddProgress, onUndo, markBtnRef }) {
  const v = useVoice();
  const measured = isMeasuredType(routine?.type);

  return (
    <div className={`wall-actions${measured ? ' measured' : ''}`}>
      {measured ? (
        <ProgressCounter
          routine={routine}
          record={record}
          onAdd={onAddProgress}
          markBtnRef={markBtnRef}
        />
      ) : (
        <MarkButton
          ref={markBtnRef}
          doneToday={doneToday}
          onClick={onMarkToday}
          label={doneToday
            ? { full: v.action.done, compact: v.action.doneShort }
            : { full: v.action.mark, compact: v.action.markShort }}
        />
      )}

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
            {v.action.undo}
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
