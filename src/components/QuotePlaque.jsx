import { motion, AnimatePresence } from 'framer-motion';
import { SoundFX } from '../lib/sound';

export default function QuotePlaque({ quote, onReroll }) {
  function handleClick() {
    SoundFX.click();
    onReroll();
  }

  return (
    <motion.div
      className="quote-plaque"
      onClick={handleClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      title="Click for another word from the wall"
    >
      <div className="quote-plaque-hook" aria-hidden="true" />
      <AnimatePresence mode="wait">
        <motion.p
          key={quote}
          className="quote-plaque-text"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.3 }}
        >
          &ldquo;{quote}&rdquo;
        </motion.p>
      </AnimatePresence>
    </motion.div>
  );
}
