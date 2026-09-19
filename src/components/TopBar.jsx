import { motion } from 'framer-motion';

export default function TopBar({ muted, onToggleMute, onAddRoutine, collapsed, openRoutines, openRecord }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        {collapsed && (
          <button type="button" className="pixel-btn pixel-btn-tiny hud-drawer-btn" onClick={openRoutines}>ROUTINES</button>
        )}
        <div className="topbar-title">
          <span className="brand-bracket">[</span>TALLY WALL<span className="brand-bracket">]</span>
        </div>
      </div>
      <div className="topbar-actions">
        {collapsed && (
          <button type="button" className="pixel-btn pixel-btn-tiny hud-drawer-btn" onClick={openRecord}>RECORD</button>
        )}
        <motion.button type="button" className="pixel-btn pixel-btn-tiny" onClick={onToggleMute} whileTap={{ scale: 0.9 }}>
          SFX: {muted ? 'OFF' : 'ON'}
        </motion.button>
        <motion.button type="button" className="pixel-btn pixel-btn-tiny" onClick={onAddRoutine} whileTap={{ scale: 0.92 }}>
          <span className="label-long">+ NEW ROUTINE</span>
          <span className="label-short">+ NEW</span>
        </motion.button>
      </div>
    </header>
  );
}
