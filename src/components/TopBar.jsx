import { motion } from 'framer-motion';
import { IconPlus } from './icons';

// Mobile (collapsed): no bar background — just the one floating icon button
// that doesn't belong to a bottom-tab destination (see BottomTabBar.jsx).
// Mute is dropped for now; it'll live inside a gear/settings icon later.
// Desktop is untouched — full text buttons, unconditionally.
export default function TopBar({ muted, onToggleMute, onAddRoutine, collapsed }) {
  if (collapsed) {
    return (
      <header className="topbar topbar-mobile">
        <motion.button
          type="button"
          className="pixel-btn pixel-icon-btn"
          onClick={onAddRoutine}
          whileTap={{ scale: 0.88 }}
          aria-label="New routine"
          title="New routine"
        >
          <IconPlus />
        </motion.button>
      </header>
    );
  }

  return (
    <header className="topbar">
      <div className="topbar-left">
        <div className="topbar-title">
          <span className="brand-bracket">[</span>TALLY WALL<span className="brand-bracket">]</span>
        </div>
      </div>
      <div className="topbar-actions">
        <motion.button type="button" className="pixel-btn pixel-btn-tiny" onClick={onToggleMute} whileTap={{ scale: 0.9 }}>
          SFX: {muted ? 'OFF' : 'ON'}
        </motion.button>
        <motion.button type="button" className="pixel-btn pixel-btn-tiny" onClick={onAddRoutine} whileTap={{ scale: 0.92 }}>
          + NEW ROUTINE
        </motion.button>
      </div>
    </header>
  );
}
