import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ModalOverlay from './ModalOverlay';
import PixelIcon from './PixelIcon';
import { roman } from '../data/guide';
import { useVoice } from '../hooks/useVoice';

// The Warden's Guide, leafed through a page at a time.
//
// A page at a time rather than one long scroll: a new user meeting the wall,
// quests, streaks, shields, XP and the chronicle all at once reads none of
// it. Eight short pages can be skipped at any point, and the whole thing is
// reachable again from settings, so nothing here is a one-time-only
// explanation the reader can lose.

export default function GuideSheet({ open, onClose }) {
  const v = useVoice();
  const [page, setPage] = useState(0);
  const [dir, setDir] = useState(1);
  const reducedMotion = useReducedMotion();

  // Always open on the first page, however it was opened.
  useEffect(() => { if (open) { setPage(0); setDir(1); } }, [open]);

  // Arrow keys leaf through, the way the buttons do.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // `go` only touches setState and a module constant, so it is stable.
  }, [open]);

  if (!open) return null;

  // each world tells the same eight pages in its own words
  const pages = v.guide.pages;
  const last = pages.length - 1;
  const current = pages[page];

  function go(step) {
    setDir(step);
    setPage((p) => Math.min(last, Math.max(0, p + step)));
  }

  const slide = (from) => (reducedMotion ? {} : { opacity: 0, x: from });

  return (
    <ModalOverlay open={open} onClose={onClose}>
      <div className="modal-title">{v.guide.title}</div>

      <div className="guide-body">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.id}
            className="guide-page"
            initial={slide(dir * 24)}
            animate={reducedMotion ? {} : { opacity: 1, x: 0 }}
            exit={slide(dir * -24)}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            <div className="guide-head">
              <span className="guide-icon"><PixelIcon icon={current.icon} /></span>
              <h3 className="guide-title">{current.title}</h3>
            </div>

            <p className="guide-lead">{current.lead}</p>
            <ul className="guide-points">
              {current.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="guide-marker" aria-hidden="true">
        {roman(page + 1)} OF {roman(pages.length)}
      </div>

      <div className="modal-actions guide-actions">
        <button
          type="button"
          className="pixel-btn pixel-btn-small"
          onClick={() => go(-1)}
          disabled={page === 0}
        >
          BACK
        </button>

        {page < last ? (
          <>
            <button type="button" className="pixel-btn pixel-btn-small" onClick={() => go(1)}>
              NEXT
            </button>
            <button type="button" className="pixel-btn pixel-btn-small guide-skip" onClick={onClose}>
              SKIP
            </button>
          </>
        ) : (
          <button type="button" className="pixel-btn pixel-btn-small" onClick={onClose}>
            TO THE WALL
          </button>
        )}
      </div>
    </ModalOverlay>
  );
}
