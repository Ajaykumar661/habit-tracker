import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';

// Animated layer over the flattened room art: lantern flames, weather, and
// whatever is awake at this time of day. Every sprite is cut from the two
// supplied sheets (see scripts/build-scene-fx.py, which also picks the spots
// and guarantees nothing is placed over the tally wall).
//
// Positions are in the room image's own pixel grid, emitted as percentages so
// they stay registered to the art at any size. Distances that need to be
// *travelled* are emitted in cqw instead — .scene-canvas is a size container,
// so 1cqw is 1% of the room's on-screen width at any zoom.
//
// Only transform, opacity and background-position animate, so all of this
// stays on the compositor.

const pct = (v, of) => `${(v / of) * 100}%`;

function useIsHidden() {
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden);
  useEffect(() => {
    const on = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', on);
    return () => document.removeEventListener('visibilitychange', on);
  }, []);
  return hidden;
}

// Phones with little to spare get a thinner crowd; the scene still reads the
// same, there's just less of everything that only adds atmosphere.
function deviceBudget() {
  if (typeof navigator === 'undefined') return 1;
  const cores = navigator.hardwareConcurrency || 8;
  const mem = navigator.deviceMemory || 8;
  return cores <= 4 || mem <= 4 ? 0.55 : 1;
}

// A small deterministic PRNG. Seeded once per mount, so the scene differs
// between visits but never reshuffles under the viewer mid-session.
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The placements are baked at build time, which fixes every drift, flicker
// and wander to the same rhythm on every load -- open the app twice and the
// clouds are in lockstep. This re-rolls the *motion* on each visit: how long
// a thing takes, where in its cycle it starts, and which wander path it
// follows.
//
// Positions are deliberately left alone. build-scene-fx.py chooses them
// against a mask that guarantees nothing is placed over the tally wall, and
// nudging x or y here would throw that guarantee away.
//
// The medieval night is excluded: it was already tuned by hand and the
// request was to leave it exactly as it is. Every other scene, in every
// theme, gets re-rolled.
const PATHS = 3;

/** Scenes whose motion is left exactly as authored. */
export const isFixedScene = (key, theme = 'medieval') => (
  theme === 'medieval' && String(key || '').includes('night')
);

/**
 * The motion for a scene: re-rolled, unless the scene is one we leave alone.
 * Exported so the rule can be tested without a browser.
 */
export function motionFor(key, place, seed, theme = 'medieval') {
  return isFixedScene(key, theme) ? place : randomiseMotion(place, seed);
}

export function randomiseMotion(place, seed) {
  const rnd = mulberry32(seed);
  // +/- 25% on a duration is enough to break visible lockstep without
  // turning a slow drift into a scurry.
  const jitter = (v, spread = 0.25) => +(v * (1 - spread + rnd() * spread * 2)).toFixed(3);

  const out = {};
  for (const [layer, items] of Object.entries(place)) {
    if (!Array.isArray(items)) { out[layer] = items; continue; }
    out[layer] = items.map((it) => {
      const next = { ...it };
      if (typeof it.dur === 'number') next.dur = jitter(it.dur);
      // A fresh negative offset starts each sprite somewhere new in its own
      // cycle, which is what actually breaks up the marching-in-step look.
      if (typeof it.delay === 'number') next.delay = -+(rnd() * next.dur).toFixed(2);
      if (typeof it.blink === 'number') next.blink = jitter(it.blink, 0.35);
      if (typeof it.path === 'number') next.path = Math.floor(rnd() * PATHS);
      return next;
    });
  }
  return out;
}

function SceneFx({ scene, streak = 0 }) {
  // Each theme ships its own sprites and placements under the same names,
  // so everything below is theme-agnostic.
  const fx = scene.fx.data;
  const key = scene.fx.key;
  const raw = fx.placements[key];
  // Re-rolled per mount, and per scene, so moving from dawn to day gives a
  // genuinely different arrangement of motion rather than the same one.
  const place = useMemo(
    () => motionFor(key, raw, (Math.random() * 2 ** 32) >>> 0, scene.theme),
    [key, raw, scene.theme],
  );
  const hidden = useIsHidden();
  const budget = useMemo(deviceBudget, []);

  // The world gets busier as the streak grows — day one is quiet, a long
  // streak has the place humming. Never empties out completely.
  const life = 0.45 + 0.55 * Math.min(1, streak / 21);

  const cq = (roomPx) => `${((roomPx / scene.width) * 100).toFixed(3)}cqw`;
  const take = (arr, factor, min = 1) =>
    (arr && arr.length ? arr.slice(0, Math.max(min, Math.round(arr.length * factor))) : []);

  // A strip is one row of uniform cells; the element is sized to one cell so
  // background-position can step through frames.
  const strip = (name, w) => {
    const s = fx.strips[name];
    return {
      backgroundImage: `url(${s.src})`,
      backgroundSize: `${s.frames * 100}% 100%`,
      width: pct(w, scene.width),
      height: pct((w * s.ch) / s.cw, scene.height),
    };
  };
  const atlas = (name, w) => {
    const [ax, ay, aw, ah] = fx.static.rects[name];
    const [AW, AH] = fx.static.atlas;
    return {
      backgroundImage: `url(${fx.static.src})`,
      backgroundSize: `${(AW / aw) * 100}% ${(AH / ah) * 100}%`,
      backgroundPosition: `${AW === aw ? 0 : (ax / (AW - aw)) * 100}% ${AH === ah ? 0 : (ay / (AH - ah)) * 100}%`,
      width: pct(w, scene.width),
      height: pct((w * ah) / aw, scene.height),
    };
  };
  // Keeps a sprite's left edge inside the visible slice of a cropped canvas.
  const onScreenLeft = (it, margin = 10) => {
    const leftPct = pct(it.x - it.w / 2, scene.width);
    const widthPct = pct(it.w, scene.width);
    return `min(${leftPct}, calc(50% + 50vw - ${widthPct} - ${margin}px))`;
  };

  // Sprites are centred on their spot; travellers are anchored at their start.
  const at = (x, y, w, h) => ({ left: pct(x - w / 2, scene.width), top: pct(y - h / 2, scene.height) });
  const spot = (it, aspect) => at(it.x, it.y, it.w, it.w * aspect);
  const stripAspect = (name) => fx.strips[name].ch / fx.strips[name].cw;
  const atlasAspect = (name) => {
    const [, , aw, ah] = fx.static.rects[name];
    return ah / aw;
  };

  return (
    <motion.div
      // fx-fluid swaps the stop-start waypoint motion for continuous paths;
      // the hand-tuned medieval night keeps its original motion untouched.
      className={`fx-layer${hidden ? ' fx-paused' : ''}${isFixedScene(key, scene.theme) ? '' : ' fx-fluid'}`}
      data-scene={key}
      aria-hidden="true"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.6 }}
    >
      {take(place.shafts, 1).map((it, i) => (
        <span key={`sh${i}`} className="fx-shaft"
          style={{ ...atlas(it.s, it.w), ...spot(it, atlasAspect(it.s)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s` }} />
      ))}

      {take(place.clouds, 1).map((it, i) => (
        <span key={`c${i}`} className="fx-cloud"
          style={{ ...atlas(it.s, it.w), ...spot(it, atlasAspect(it.s)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s`, '--op': it.op,
            '--tx': cq(it.w * 0.22) }} />
      ))}

      {take(place.mist, 1).map((it, i) => (
        <span key={`m${i}`} className="fx-mist"
          style={{ ...atlas(it.s, it.w), ...spot(it, atlasAspect(it.s)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s`, '--tx': cq(it.w * 0.18) }} />
      ))}

      {take(place.stars, budget).map((it, i) => (
        <span key={`s${i}`} className="fx-star fx-step-4"
          style={{ ...strip(`star-${it.k}`, it.w), ...spot(it, stripAspect(`star-${it.k}`)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s` }} />
      ))}

      {take(place.shoot, 1).map((it, i) => (
        <span key={`ss${i}`} className="fx-shoot fx-step-5"
          style={{ ...strip('shoot', it.w), ...spot(it, stripAspect('shoot')),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s`,
            '--tx': cq(it.dx), '--ty': cq(it.dy) }} />
      ))}

      {take(place.fireflies, life * budget).map((it, i) => (
        <span key={`f${i}`} className={`fx-firefly fx-step-4 fx-path-${it.path}`}
          style={{ ...strip('firefly', it.w), ...spot(it, stripAspect('firefly')),
            '--dur': `${it.dur}s`, '--blink': `${it.blink}s`, '--delay': `${it.delay}s`,
            '--amp': cq(it.w * 1.6) }} />
      ))}

      {take(place.fglow, life * budget).map((it, i) => (
        <span key={`g${i}`} className="fx-fglow"
          style={{ ...atlas(it.s, it.w), ...spot(it, atlasAspect(it.s)),
            // A sign's halo is capped and screened; filter opacity stacks
            // with the animated `opacity`, so the pulse survives the cap.
            filter: it.op ? `opacity(${it.op})` : undefined,
            mixBlendMode: it.blend,
            '--blink': `${it.blink}s`, '--delay': `${it.delay}s` }} />
      ))}

      {take(place.motes, life * budget).map((it, i) => (
        <span key={`mo${i}`} className={`fx-mote fx-path-${it.path}`}
          style={{ ...atlas(it.s, it.w), ...spot(it, atlasAspect(it.s)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s`, '--amp': cq(it.w * 2.4) }} />
      ))}

      {take(place.embers, budget).map((it, i) => (
        <span key={`e${i}`} className={`fx-ember fx-step-3${it.rise < 0 ? ' fx-fall' : ''}`}
          style={{ ...strip(it.k, it.w), ...spot(it, stripAspect(it.k)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s`, '--rise': cq(it.rise) }} />
      ))}

      {[['birds', 'fx-step-5'], ['bats', 'fx-step-4'], ['butterflies', 'fx-step-4']].map(([kind, step]) =>
        take(place[kind], life * budget).map((it, i) => (
          <span key={`${kind}${i}`} className={`fx-traveller ${step}${it.flip ? ' flip' : ''}`}
            style={{ ...strip(it.k, it.w), ...spot(it, stripAspect(it.k)),
              '--dur': `${it.dur}s`, '--delay': `${it.delay}s`, '--span': cq(it.span),
              '--bob': cq(it.w * 0.5) }} />
        )))}

      {place.flames.map((it, i) => {
        const s = fx.strips[it.k];
        const h = (it.w * s.ch) / s.cw;
        return (
          <span key={`fl${i}`} className="fx-flame fx-step-11"
            style={{ ...strip(it.k, it.w),
              left: pct(it.x - it.w / 2, scene.width),
              top: pct(it.y + 2 - h, scene.height),
              animationDuration: `${0.86 + i * 0.07}s, ${2.6 + i * 0.4}s`,
              animationDelay: `${-i * 0.29}s, ${-i * 0.5}s` }} />
        );
      })}

      {(place.cat || []).map((it, i) => (
        <span key={`cat${i}`} className="fx-cat fx-step-6"
          style={{ ...strip('cat', it.w), ...spot(it, stripAspect('cat')),
            // She sleeps three quarters of the way across the room, and on a
            // very tall phone the canvas is scaled to cover the height, so
            // that much of the width is cropped away and her tail goes with
            // it. The canvas is centred, so the viewport's right edge sits at
            // `50% + 50vw` in canvas coordinates: never let her start further
            // right than that leaves room for. On every ordinary screen the
            // painted position wins and nothing moves.
            left: onScreenLeft(it),
            animationDuration: `${it.dur}s` }} />
      ))}

      {place.zzz.map((it, i) => (
        <span key={`z${i}`} className="fx-zzz"
          style={{ ...atlas(it.s, it.w), ...spot(it, atlasAspect(it.s)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s`, '--rise': cq(it.rise) }} />
      ))}
    </motion.div>
  );
}

export default memo(SceneFx);
