import { useId, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// A retractable panel. The header is the handle — the whole thing is one
// button so it works by keyboard and reads correctly to a screen reader,
// rather than a heading with a decorative arrow stuck beside it.
//
// The open/closed choice is remembered for the session only: it is a glance
// preference, not a setting worth persisting into the chronicle.
//
// Every panel in the HUD uses this, so the carets, the animation and the
// aria contract are defined once rather than four times.
export default function Tray({
  area, label, count, defaultOpen = true, className = '', children,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const reducedMotion = useReducedMotion();
  const bodyId = `tray-${useId().replace(/:/g, '')}`;

  return (
    <div data-area={area} className={`tray${open ? ' open' : ''}${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="tray-handle panel-title"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
      >
        <span className="tray-caret" aria-hidden="true" />
        <span className="tray-label">{label}</span>
        {count != null && <span className="tray-count">{count}</span>}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={bodyId}
            className="tray-body"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={reducedMotion ? {} : { height: 'auto', opacity: 1 }}
            exit={reducedMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
