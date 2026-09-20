import { memo, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import fx from '../data/sceneFx.json';

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

function SceneFx({ scene, streak = 0 }) {
  const place = fx.placements[scene.fx.key];
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
      className={`fx-layer${hidden ? ' fx-paused' : ''}`}
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
            '--blink': `${it.blink}s`, '--delay': `${it.delay}s` }} />
      ))}

      {take(place.motes, life * budget).map((it, i) => (
        <span key={`mo${i}`} className={`fx-mote fx-path-${it.path}`}
          style={{ ...atlas(it.s, it.w), ...spot(it, atlasAspect(it.s)),
            '--dur': `${it.dur}s`, '--delay': `${it.delay}s`, '--amp': cq(it.w * 2.4) }} />
      ))}

      {take(place.embers, budget).map((it, i) => (
        <span key={`e${i}`} className="fx-ember fx-step-3"
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
