import { motion } from 'framer-motion';
import { IconPlus, IconGear } from './icons';

// Mobile (collapsed): no bar background — just the two floating icon buttons
// that don't belong to a bottom-tab destination (see BottomTabBar.jsx).
// Mute lives in the settings sheet behind the gear, not out here.
// Desktop keeps its text buttons; the gear is added alongside them.
export default function TopBar({ muted, onToggleMute, onAddRoutine, onOpenSettings, collapsed }) {
  if (collapsed) {
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
        <motion.button type="button" className="pixel-btn pixel-btn-tiny" onClick={onToggleMute} whileTap={{ scale: 0.9 }}>
          SFX: {muted ? 'OFF' : 'ON'}
        </motion.button>
        <motion.button type="button" className="pixel-btn pixel-btn-tiny" onClick={onAddRoutine} whileTap={{ scale: 0.92 }}>
          + NEW ROUTINE
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
