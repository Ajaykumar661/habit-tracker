import { motion, AnimatePresence } from 'framer-motion';

export default function Sidebar({ routines, activeRoutine, onSelect, onDelete }) {
  return (
    <div className="sidebar">
      <h2 className="panel-title">ROUTINES</h2>
      <ul className="routine-list">
        <AnimatePresence initial={false}>
          {routines.map((r) => (
            <motion.li
              key={r.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12, height: 0 }}
              className={'routine-item' + (r.id === activeRoutine.id ? ' active' : '')}
              onClick={() => onSelect(r.id)}
            >
              <span className="routine-item-name">{r.name}</span>
              {routines.length > 1 && (
                <button
                  className="routine-delete-btn"
                  title="Delete routine"
                  onClick={(e) => { e.stopPropagation(); onDelete(r); }}
                >
                  ×
                </button>
              )}
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}
