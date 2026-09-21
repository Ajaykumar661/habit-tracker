import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { earnedMilestones, catLookFor } from '../domain/room';
import { SoundFX } from '../lib/sound';
import { useVoice } from '../hooks/useVoice';

// What the room has earned, and the cat you can pet.
//
//   milestone objects  stand where build-extras.py placed them, per
//                      orientation, once the best-ever streak reaches them
//   the cat's look     a bed at 30 days, her crown at 100 -- drawn in place
//                      of her sleeping body, on her own ledge
//   petting            tap her: she wakes, stretches, purrs, settles back
//   the season         petals, leaves or snow drifting down, and the
//                      season's decoration where the theme has one
//
// Every object says what it is: tap it for a small plaque ("THE FIRST
// CANDLE -- earned for a 7-day streak"). One earned since it was last seen
// sparkles, and its plaque shows once by itself; `seenDay` remembers.
//
// Positions are in the room image's own pixels and emitted as percentages,
// exactly like SceneFx, so everything stays registered to the art.

const PET_MS = 2600;      // the whole wake-stretch-purr-settle, once
const HEART_MS = 1500;
const LABEL_MS = 3200;
const FRESH_MS = 5200;    // a newly earned object's plaque stays a little longer

// How each season's particles move: size range (room px), seconds to fall
// the height of the room, how far they sway, and how much they turn.
const DRIFT = {
  spring: { size: [16, 26], fall: [16, 22], sway: [2, 5], spin: 180 },
  autumn: { size: [18, 30], fall: [20, 28], sway: [3, 6], spin: 260 },
  winter: { size: [12, 22], fall: [14, 22], sway: [1, 3], spin: 90 },
};

/** Drawn height of a milestone object at its spot. */
function objectHeight(m, s) {
  const f = m.flicker;
  return f ? (s.w * f.ch) / f.cw : (s.w * m.h) / m.w;
}

/** A fixed flurry for a season: the same on every render, varied within. */
function flurry(season, count) {
  const d = DRIFT[season];
  if (!d) return [];
  let seed = [...season].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const span = ([a, b]) => a + (b - a) * rnd();
  return Array.from({ length: count }, () => {
    const fall = span(d.fall);
    return {
      x: rnd() * 100,
      size: span(d.size),
      fall,
      delay: -rnd() * fall,
      sway: span(d.sway) * (rnd() < 0.5 ? -1 : 1),
      swayDur: 2.4 + rnd() * 2.2,
      spin: (rnd() < 0.5 ? -1 : 1) * d.spin * (0.5 + rnd()),
    };
  });
}

function RoomExtras({ scene, extras, best, season, sparse = false, seenDay = 0, onSeen }) {
  const words = useVoice().room;
  const [petting, setPetting] = useState(false);
  const [label, setLabel] = useState(null);   // { title, sub, x, y, fresh }
  const [freshId, setFreshId] = useState(null);
  const timer = useRef(null);
  const labelTimer = useRef(null);
  const freshTimer = useRef(null);
  useEffect(() => () => {
    clearTimeout(timer.current); clearTimeout(labelTimer.current); clearTimeout(freshTimer.current);
  }, []);

  const show = useCallback((next, ms = LABEL_MS) => {
    clearTimeout(labelTimer.current);
    setLabel(next);
    labelTimer.current = setTimeout(() => setLabel(null), ms);
  }, []);

  const pct = (v, of) => `${(v / of) * 100}%`;
  const orient = scene.orientation;
  const flakes = useMemo(() => flurry(season, sparse ? 10 : 18), [season, sparse]);
  // a portrait room is drawn about half as large, so its flakes are bigger
  const flakeScale = orient === 'portrait' ? 1.7 : 1;
  const look = catLookFor(extras?.cat, best);

  const pet = useCallback(() => {
    if (petting) return;
    setPetting(true);
    SoundFX.purr();
    timer.current = setTimeout(() => setPetting(false), PET_MS);
  }, [petting]);

  // An object earned since the room was last seen: sparkle it, show its
  // plaque once, and remember the room as seen up to the best object held.
  const earned = earnedMilestones(extras?.milestones, best);
  const fresh = [...earned].reverse().find((m) => m.day > seenDay && m.spots?.[orient]);
  const heldDay = earned.length ? earned[earned.length - 1].day : 0;
  useEffect(() => {
    if (!fresh) return undefined;
    const s = fresh.spots[orient];
    setFreshId(fresh.id);
    show({ title: words.fresh, sub: `${words.names[fresh.id] || fresh.id} · ${words.earned(fresh.day)}`,
      x: s.x, y: s.y - objectHeight(fresh, s), fresh: true }, FRESH_MS);
    onSeen?.(heldDay);
    clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setFreshId(null), FRESH_MS);
    return undefined;
    // announced once per newly earned object
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh?.id]);

  if (!extras) return null;

  // Her spot comes from the scene's own fx placements, so she is wherever
  // the sleeping cat is -- and only where there is one.
  const fx = scene.fx?.data;
  const catSpot = fx?.placements?.[scene.fx.key]?.cat?.[0];
  const catStrip = fx?.strips?.cat;
  let cat = null;
  if (catSpot && catStrip) {
    const h = (catSpot.w * catStrip.ch) / catStrip.cw;
    const top = catSpot.y - h / 2;
    cat = {
      x: catSpot.x,
      w: catSpot.w,
      // the line she lies on: the top of her ledge
      floor: top + h * (catStrip.seam ?? 1),
      top,
      h,
    };
  }

  // Keeps a sprite's left edge inside the visible slice of a cropped canvas,
  // the same way SceneFx keeps the sleeping cat on screen.
  const onScreenLeft = (x, w, margin = 10) => (
    `min(${pct(x - w / 2, scene.width)}, calc(50% + 50vw - ${pct(w, scene.width)} - ${margin}px))`
  );
  // A sprite of drawn width `w`, standing on the line `floor`.
  const standing = (x, floor, w, iw, ih, clampLeft = false) => {
    const h = (w * ih) / iw;
    return {
      left: clampLeft ? onScreenLeft(x, w) : pct(x - w / 2, scene.width),
      top: pct(floor - h, scene.height),
      width: pct(w, scene.width),
      height: pct(h, scene.height),
    };
  };

  // Every object has its slot on the shelf; the ones not yet earned stand
  // there as silhouettes, so the shelf reads as a collection to complete.
  const items = extras.milestones || [];
  const held = new Set(earned.map((m) => m.id));
  const tellAbout = (m, s) => {
    SoundFX.click();
    show({
      title: words.names[m.id] || m.id,
      sub: held.has(m.id) ? words.earned(m.day) : words.locked(m.day),
      x: s.x, y: s.y - objectHeight(m, s),
    });
  };
  const lookSprite = look ? extras.cat[look] : null;
  const away = !!cat && (petting || !!lookSprite);

  return (
    <div
      className="room-extras"
      data-cat-away={away ? '' : undefined}
      data-petting={petting ? '' : undefined}
      aria-hidden={!cat}
    >
      {(extras.shelves?.[orient] || []).map((pl) => (
        <img key={pl.src} className="room-shelf" src={pl.src} alt="" draggable="false"
          style={{
            left: pct(pl.x, scene.width), top: pct(pl.y, scene.height),
            width: pct(pl.w, scene.width), height: pct(pl.h, scene.height),
          }} />
      ))}

      {items.map((m) => {
        const s = m.spots?.[orient];
        if (!s) return null;
        const got = held.has(m.id);
        // a silhouette never flickers
        const f = got ? m.flicker : null;
        const cls = `room-obj${got ? '' : ' room-locked'}${m.id === freshId ? ' room-new' : ''}`;
        const tap = { onClick: () => tellAbout(m, s), role: 'button', 'aria-label': words.names[m.id] || m.id };
        return f ? (
          <span key={m.id} className={`${cls} room-flicker room-flicker-${m.id}`} {...tap}
            style={{
              ...standing(s.x, s.y, s.w, f.cw, f.ch),
              backgroundImage: `url(${f.src})`,
              backgroundSize: `${f.frames * 100}% 100%`,
            }} />
        ) : (
          <img key={m.id} className={cls} src={m.src} alt="" draggable="false" {...tap}
            style={standing(s.x, s.y, s.w, m.w, m.h)} />
        );
      })}

      {(() => {
        const d = extras.seasons?.[season]?.decoration;
        const s = d?.spots?.[orient];
        return s ? (
          <img className="room-obj room-deco" src={d.src} alt="" draggable="false"
            role="button" aria-label={words.decos[season]}
            onClick={() => {
              SoundFX.click();
              show({ title: words.decos[season], sub: words.season, x: s.x, y: s.y - (s.w * d.h) / d.w });
            }}
            style={standing(s.x, s.y, s.w, d.w, d.h)} />
        ) : null;
      })()}

      {cat && lookSprite && (
        <img className={`room-cat-look${petting ? ' purring' : ''}`} src={lookSprite.src} alt="" draggable="false"
          style={standing(cat.x, cat.floor, cat.w * lookSprite.rel, lookSprite.w, lookSprite.h, true)} />
      )}

      {cat && petting && !lookSprite && extras.cat.pet && (() => {
        const p = extras.cat.pet;
        return (
          <span className="room-cat-pet"
            style={{
              ...standing(cat.x, cat.floor, cat.w * p.rel, p.cw, p.ch, true),
              backgroundImage: `url(${p.src})`,
              backgroundSize: `${p.frames * 100}% 100%`,
              animationDuration: `${PET_MS}ms`,
            }} />
        );
      })()}

      {cat && petting && extras.cat.heart && (() => {
        const hs = extras.cat.heart;
        const w = cat.w * 0.28;
        return (
          <span className="room-cat-heart"
            style={{
              ...standing(cat.x + cat.w * 0.12, cat.top + cat.h * 0.1, w, hs.cw, hs.ch, true),
              backgroundImage: `url(${hs.src})`,
              backgroundSize: `${hs.frames * 100}% 100%`,
              animationDuration: `${HEART_MS}ms, ${HEART_MS}ms`,
              animationDelay: `${PET_MS * 0.45}ms, ${PET_MS * 0.45}ms`,
            }} />
        );
      })()}

      {(() => {
        const p = extras.seasons?.[season]?.particle;
        if (!p) return null;
        // the room's height in cqw, so a flake falls the whole way at any size
        const fall = `${((scene.height / scene.width) * 100 * 1.08).toFixed(2)}cqw`;
        return flakes.map((f, i) => (
          <span key={`p${i}`} className="room-fall"
            style={{
              left: `${f.x}%`,
              width: pct(f.size * flakeScale, scene.width),
              height: pct((f.size * flakeScale * p.h) / p.w, scene.height),
              '--fall': fall,
              animationDuration: `${f.fall}s`,
              animationDelay: `${f.delay}s`,
            }}>
            <span className="room-flake"
              style={{
                backgroundImage: `url(${p.src})`,
                '--sway': `${f.sway}cqw`,
                '--spin': `${f.spin}deg`,
                animationDuration: `${f.swayDur}s, ${f.fall}s`,
                animationDelay: `${f.delay}s, ${f.delay}s`,
              }} />
          </span>
        ));
      })()}

      {label && (
        <div className={`room-label${label.fresh ? ' fresh' : ''}`} role="status"
          // centred on the object, but never past the edge of a cropped screen
          style={{
            left: `clamp(calc(50% - 50vw + 120px), ${pct(label.x, scene.width)}, calc(50% + 50vw - 120px))`,
            top: pct(label.y, scene.height),
          }}>
          <span className="room-label-title">{label.title}</span>
          <span className="room-label-sub">{label.sub}</span>
        </div>
      )}

      {cat && (
        <button
          type="button"
          className="room-cat-hit"
          aria-label="Pet the cat"
          onClick={pet}
          style={{
            left: onScreenLeft(cat.x, cat.w),
            top: pct(cat.top, scene.height),
            width: pct(cat.w, scene.width),
            height: pct(cat.floor - cat.top, scene.height),
          }}
        />
      )}
    </div>
  );
}

export default memo(RoomExtras);
