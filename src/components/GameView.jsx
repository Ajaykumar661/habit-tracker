import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { wallSurface } from '../data/assets';
import { useSceneLayout } from '../hooks/useSceneLayout';

// The "game screen": a fixed, full-viewport room with the HUD around it.
//   room art + tally wall   (world)
//   vignette                (lighting only at the edges — centre untouched)
//   HUD zones               (left routines, right record, bottom actions)
// Slots that need to react to the layout are render props.
export default function GameView({ scene, shake, topBar, title, wall, left, right, bottom }) {
  const { layout, bottomRef } = useSceneLayout(scene);
  const { canvas, collapsed, hudWidth, bottomTop, bottomCenter, bottomMaxWidth, wallInset } = layout;
  const [drawer, setDrawer] = useState(null); // 'routines' | 'record' | null

  useEffect(() => { if (!collapsed) setDrawer(null); }, [collapsed]);
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer]);

  const pct = (v, of) => `${(v / of) * 100}%`;
  const box = (r) => ({
    left: pct(r.x, scene.width), top: pct(r.y, scene.height),
    width: pct(r.w, scene.width), height: pct(r.h, scene.height),
  });
  const closeDrawer = () => setDrawer(null);
  const panelClass = (side, name) => ['hud-panel', `hud-${side}`, collapsed && 'hud-drawer', drawer === name && 'open']
    .filter(Boolean).join(' ');

  return (
    <div
      className="game-view"
      data-lighting={scene.lighting}
      style={{ '--hud-w': `${hudWidth}px`, '--wall-inset-l': `${wallInset.left}px`, '--wall-inset-r': `${wallInset.right}px` }}
    >
      <motion.div className="game-shake" animate={shake}>
        <div
          className="scene-canvas"
          style={{ ...canvas, '--wall-surface': `url('${wallSurface.src}')` }}
        >
          <div className="scene-wall" style={box(scene.regions.wall)}>{wall}</div>
          <AnimatePresence initial={false}>
            <motion.img
              key={scene.src}
              className="scene-art"
              src={scene.src}
              alt=""
              draggable="false"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.6 }}
            />
          </AnimatePresence>
          <div className="scene-title" style={box(scene.regions.title)}>{title}</div>
        </div>
        <div className="scene-vignette" aria-hidden="true" />
      </motion.div>

      <div className="hud-top">
        {topBar({
          collapsed,
          openRoutines: () => setDrawer('routines'),
          openRecord: () => setDrawer('record'),
        })}
      </div>

      {collapsed && drawer && <div className="hud-backdrop" onClick={closeDrawer} aria-hidden="true" />}

      <aside className={panelClass('left', 'routines')} aria-label="Routines">{left({ closeDrawer })}</aside>
      <aside className={panelClass('right', 'record')} aria-label="Record and achievements">{right()}</aside>

      <div
        ref={bottomRef}
        className="hud-bottom"
        style={{ top: bottomTop, left: bottomCenter, maxWidth: bottomMaxWidth }}
      >
        {bottom}
      </div>
    </div>
  );
}
