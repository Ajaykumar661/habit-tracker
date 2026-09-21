import { motion } from 'framer-motion';
import { IconPlus, IconGear } from './icons';
import { useVoice } from '../hooks/useVoice';

// Mobile (collapsed): no bar background — just the two floating icon buttons
// that don't belong to a bottom-tab destination (see BottomTabBar.jsx).
// Sound and music live in the settings sheet behind the gear on every size,
// so the bar carries only what has nowhere else to go.
export default function TopBar({ onAddRoutine, onOpenSettings, collapsed }) {
  const v = useVoice();
  if (collapsed) {
    // Source order is the visual order: the bar is space-between, so the
    // gear sits at the left edge and new-routine at the right.
    return (
      <header className="topbar topbar-mobile">
        <motion.button
          type="button"
          className="pixel-btn pixel-icon-btn"
          onClick={onOpenSettings}
          whileTap={{ scale: 0.88 }}
          aria-label="Settings"
          title="Settings"
        >
          <IconGear />
        </motion.button>
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
        <motion.button type="button" className="pixel-btn pixel-btn-tiny" onClick={onAddRoutine} whileTap={{ scale: 0.92 }}>
          {v.newHabit}
        </motion.button>
        <motion.button
          type="button"
          className="pixel-btn pixel-btn-tiny pixel-icon-btn"
          onClick={onOpenSettings}
          whileTap={{ scale: 0.9 }}
          aria-label="Settings"
          title="Settings"
        >
          <IconGear />
        </motion.button>
      </div>
    </header>
  );
}
