import { motion, AnimatePresence } from 'framer-motion';
import { forwardRef } from 'react';
import { progressOf, stepFor, isMeasuredType, formatDuration, SECONDS_PER_MINUTE } from '../domain/completion';
import { useVoice } from '../hooks/useVoice';

const MarkButton = forwardRef(function MarkButton({ onClick, label }, ref) {
  return (
    <motion.button
      ref={ref}
      type="button"
      className="pixel-btn action-btn action-mark"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.94, y: 1 }}
      transition={{ duration: 0.18 }}
    >
      <span className="label-full">{label.full}</span>
      <span className="label-compact">{label.compact}</span>
    </motion.button>
  );
});

function UndoButton({ onClick, label }) {
  return (
    <motion.button
      type="button"
      className="pixel-btn action-btn action-undo"
      onClick={onClick}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      whileTap={{ scale: 0.94 }}
      transition={{ duration: 0.18 }}
    >
      <svg className="action-undo-glyph" viewBox="0 0 8 8" aria-hidden="true" shapeRendering="crispEdges">
        <path d="M1 2h1v1h-1zM2 1h1v3h-1zM3 2h4v1h-4zM7 3h1v3h-1zM3 6h4v1h-4z" fill="currentColor" />
      </svg>
      {label}
    </motion.button>
  );
}

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

  if (measured) {
    return (
      <div className="wall-actions measured">
        <ProgressCounter
          routine={routine}
          record={record}
          onAdd={onAddProgress}
          markBtnRef={markBtnRef}
        />
        <AnimatePresence initial={false}>
          {doneToday && <UndoButton key="undo" onClick={onUndo} label={v.action.undo} />}
        </AnimatePresence>
      </div>
    );
  }

  // Once today is logged there is nothing left to press but a way back: the
  // day block beside this already says it is done, so no dead button does.
  return (
    <div className="wall-actions">
      <AnimatePresence mode="wait" initial={false}>
        {doneToday ? (
          <UndoButton key="undo" onClick={onUndo} label={v.action.undo} />
        ) : (
          <MarkButton
            key="mark"
            ref={markBtnRef}
            onClick={onMarkToday}
            label={{ full: v.action.mark, compact: v.action.markShort }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
