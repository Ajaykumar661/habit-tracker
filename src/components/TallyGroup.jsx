import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

// Carved/chalked tally marks, after the supplied tally-wall-medieval.svg:
// each stroke is a dark recessed groove with a muted chalk line on top,
// roughened by an SVG displacement filter (defined once in TallyWall).
// The fifth day is a broken, irregular slash dragged across the four.
//
// Geometry is in the reference's own units (a group is ~45×41), so the
// filter strengths carry over unchanged; CSS scales the SVG to the wall.

// Deterministic per-date randomness: the same day always carves the same
// way, so marks never shift between renders or reloads.
function rngFor(seed) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return (min, max) => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return min + ((h >>> 0) / 4294967296) * (max - min);
  };
}

const f = (n) => n.toFixed(2);
const SPACING = 13;
const SHADOW_OFFSET = 'translate(1.2 1.5)';

function carveMark(dateStr, i) {
  const r = rngFor(dateStr);
  const x = i * SPACING + r(-0.8, 0.8);
  const top = r(-1, 2);
  const bottom = r(38.5, 41);
  const lean = r(-2, 0.3);
  const midX = x + lean * 0.5 + r(-0.5, 0.5); // slight hand wobble
  const chipY = r(6, 34);
  return {
    d: `M${f(x)} ${f(top)} L${f(midX)} ${f((top + bottom) / 2)} L${f(x + lean)} ${f(bottom)}`,
    width: r(3.9, 4.4),
    opacity: r(0.8, 0.88),
    chip: r(0, 1) < 0.6 ? `M${f(x + lean * (chipY / 40) - 1.5)} ${f(chipY)} l${f(r(2, 3))} ${f(-r(1.5, 2.5))}` : null,
  };
}

// The slash: one continuous groove underneath, but the chalk on top is
// broken into segments of uneven width with two worn gaps — chalk dragged
// across stone, not a clean vector line.
function carveSlash(dateStr) {
  const r = rngFor(`${dateStr}/slash`);
  const x0 = -1 + r(-1, 0.5); const y0 = 40 + r(-0.5, 1);
  const x1 = 42 + r(-0.5, 1.5); const y1 = -1 + r(-1, 1);
  const len = Math.hypot(x1 - x0, y1 - y0);
  const nx = -(y1 - y0) / len; const ny = (x1 - x0) / len; // perpendicular

  const STEPS = 12;
  const pts = [];
  for (let s = 0; s <= STEPS; s++) {
    const t = s / STEPS;
    const wob = s === 0 || s === STEPS ? 0 : r(-0.9, 0.9);
    pts.push([x0 + (x1 - x0) * t + nx * wob, y0 + (y1 - y0) * t + ny * wob, t]);
  }
  const pointAt = (t) => {
    const k = Math.min(STEPS - 1, Math.floor(t * STEPS));
    const [ax, ay] = pts[k]; const [bx, by] = pts[k + 1];
    const u = t * STEPS - k;
    return [ax + (bx - ax) * u, ay + (by - ay) * u];
  };
  const pathBetween = (t0, t1) => {
    const inner = pts.filter(([, , t]) => t > t0 && t < t1);
    return [pointAt(t0), ...inner, pointAt(t1)]
      .map(([px, py], idx) => `${idx ? 'L' : 'M'}${f(px)} ${f(py)}`).join(' ');
  };

  const g1 = r(0.26, 0.38); const g2 = r(0.58, 0.72);
  const ranges = [[0, g1], [g1 + r(0.03, 0.05), g2], [g2 + r(0.03, 0.06), 1]];
  return {
    groove: pathBetween(0, 1),
    segments: ranges.map(([a, b]) => ({ d: pathBetween(a, b), width: r(3.4, 4.4), opacity: r(0.7, 0.8) })),
  };
}

const DRAW = { duration: 0.26, ease: [0.3, 0.7, 0.4, 1] };
const STAGGER = 0.06;

export default function TallyGroup({ dates, fade = 1, fresh, onOpen, onEnter, onMove, onLeave }) {
  const reducedMotion = useReducedMotion();
  const verticals = dates.slice(0, 4);
  const slash = dates.length === 5 ? carveSlash(dates[4]) : null;

  // Scratch-in: the stroke is drawn along its length. Reduced motion → fade.
  const draw = (delay) => (reducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.15 } }
    : { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { ...DRAW, delay } });

  return (
    <motion.div
      className={'tally-group' + (fresh ? ' fresh' : '')}
      layout
      animate={{ opacity: fade }}
      transition={{ opacity: { duration: 0.4 } }}
      onClick={() => onOpen(dates)}
      onMouseEnter={(e) => onEnter && onEnter(e, dates)}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      <svg viewBox="-4 -4 52 50" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* Marks already on the wall at mount don't re-carve themselves;
            only a group that appears for a freshly added day animates in. */}
        <AnimatePresence initial={!!fresh}>
          {verticals.map((d, i) => {
            const m = carveMark(d, i);
            return (
              <motion.g key={d} filter="url(#tally-roughen)" exit={{ opacity: 0, transition: { duration: 0.2 } }}>
                <motion.path d={m.d} className="tally-groove" strokeWidth={5} opacity={0.72} transform={SHADOW_OFFSET} {...draw(i * STAGGER)} />
                <motion.path d={m.d} className="tally-chalk" strokeWidth={m.width} opacity={m.opacity} {...draw(i * STAGGER)} />
                {m.chip && <path d={m.chip} className="tally-chip" strokeWidth={1.4} opacity={0.62} />}
              </motion.g>
            );
          })}
          {slash && (
            <motion.g key={`slash-${dates[4]}`} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <motion.path d={slash.groove} className="tally-groove" strokeWidth={5} opacity={0.6}
                transform={SHADOW_OFFSET} filter="url(#tally-roughen)" {...draw(4 * STAGGER)} />
              {slash.segments.map((s, k) => (
                <motion.path key={k} d={s.d} className="tally-slash" strokeWidth={s.width} opacity={s.opacity}
                  filter="url(#tally-slash-rough)" {...draw(4 * STAGGER + k * 0.09)} />
              ))}
            </motion.g>
          )}
        </AnimatePresence>
      </svg>
    </motion.div>
  );
}
