import { motion, AnimatePresence } from 'framer-motion';

export default function ParticleLayer({ particles, onDone }) {
  return (
    <AnimatePresence>
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="particle"
          style={{
            left: p.x,
            top: p.y,
            width: p.big ? 6 : 4,
            height: p.big ? 6 : 4,
            background: p.color,
          }}
          initial={{ opacity: 1, x: 0, y: 0, scale: 1 }}
          animate={{ opacity: 0, x: p.dx, y: p.dy, scale: 0.3, rotate: p.rotate }}
          transition={{ duration: p.big ? 0.75 : 0.6, ease: [0.2, 0.8, 0.3, 1] }}
          onAnimationComplete={() => onDone(p.id)}
        />
      ))}
    </AnimatePresence>
  );
}
