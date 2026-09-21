import { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Every dialog is capped at the visible screen and scrolls inside itself,
// with a close button pinned to its top corner. Settings grew past a phone's
// screen, and its only way out -- CLOSE at the bottom -- ended up below the
// fold with nothing to scroll.
export default function ModalOverlay({ open, onClose, children }) {
  // Escape closes any dialog on a keyboard, as the X does on a screen.
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="modal-overlay"
          initial={{ opacity: 0, pointerEvents: 'auto' }}
          animate={{ opacity: 1, pointerEvents: 'auto' }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            className="modal pixel-panel"
            initial={{ opacity: 0, scale: 0.7, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.7, y: 20 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
          >
            <button type="button" className="modal-x" onClick={onClose} aria-label="Close" title="Close" />
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
