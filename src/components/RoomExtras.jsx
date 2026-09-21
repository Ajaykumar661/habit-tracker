import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { earnedMilestones, catLookFor } from '../domain/room';
import { SoundFX } from '../lib/sound';

// What the room has earned, and the cat you can pet.
//
//   milestone objects  stand where build-extras.py placed them, per
//                      orientation, once the best-ever streak reaches them
//   the cat's look     a bed at 30 days, her crown at 100 -- drawn in place
//                      of her sleeping body, on her own ledge
//   petting            tap her: she wakes, stretches, purrs, settles back
//
// Positions are in the room image's own pixels and emitted as percentages,
// exactly like SceneFx, so everything stays registered to the art.

const PET_MS = 2600;      // the whole wake-stretch-purr-settle, once
const HEART_MS = 1500;

function RoomExtras({ scene, extras, best }) {
  const [petting, setPetting] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const pct = (v, of) => `${(v / of) * 100}%`;
  const orient = scene.orientation;
  const look = catLookFor(extras?.cat, best);

  const pet = useCallback(() => {
    if (petting) return;
    setPetting(true);
    SoundFX.purr();
    timer.current = setTimeout(() => setPetting(false), PET_MS);
  }, [petting]);

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

  const items = earnedMilestones(extras.milestones, best);
  const lookSprite = look ? extras.cat[look] : null;
  const away = !!cat && (petting || !!lookSprite);

  return (
    <div
      className="room-extras"
      data-cat-away={away ? '' : undefined}
      data-petting={petting ? '' : undefined}
      aria-hidden={!cat}
    >
      {items.map((m) => {
        const s = m.spots?.[orient];
        if (!s) return null;
        const f = m.flicker;
        return f ? (
          <span key={m.id} className={`room-obj room-flicker room-flicker-${m.id}`}
            style={{
              ...standing(s.x, s.y, s.w, f.cw, f.ch),
              backgroundImage: `url(${f.src})`,
              backgroundSize: `${f.frames * 100}% 100%`,
            }} />
        ) : (
          <img key={m.id} className="room-obj" src={m.src} alt="" draggable="false"
            style={standing(s.x, s.y, s.w, m.w, m.h)} />
        );
      })}

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
