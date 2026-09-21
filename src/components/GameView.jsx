import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { sceneFor, themeFor } from '../data/themes';
import { useSceneLayout, useIsNarrowViewport } from '../hooks/useSceneLayout';
import BottomTabBar from './BottomTabBar';
import SceneFx from './SceneFx';
import RoomExtras from './RoomExtras';

// The "game screen": a fixed, full-viewport room with the HUD around it.
//   room art + tally wall   (world)
//   vignette                (lighting only at the edges — centre untouched)
//   HUD zones               (left routines, right record, bottom actions)
// Slots that need to react to the layout are render props.
// `drawer`/`setDrawer` ('routines' | 'record' | null) are lifted to App so
// the Android hardware back button can close whichever is open (see
// App.jsx's backButton listener) without GameView knowing about Capacitor.
export default function GameView({ envState, theme, streak, best = 0, shake, topBar, title, wall, left, right, bottom, drawer, setDrawer, onOpenCalendar }) {
  // Below the breakpoint, swap to the portrait room (archway sits above the
  // wall there, so its own cover-scaled crop keeps the sky in frame — see
  // each theme's portrait set in data/themes). Picked here, before
  // useSceneLayout, since that hook's wall-centring math needs the right
  // frame's own regions -- which differ between themes as well.
  const narrowArt = useIsNarrowViewport();
  const scene = sceneFor(envState, narrowArt, theme);
  const { wall: wallArt, id: themeId, extras } = themeFor(theme);
  const { layout, bottomRef } = useSceneLayout(scene);
  const { canvas, collapsed, hudWidth, bottomTop, bottomCenter, bottomMaxWidth, wallInset } = layout;

  useEffect(() => { if (!collapsed) setDrawer(null); }, [collapsed, setDrawer]);
  useEffect(() => {
    if (!drawer) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setDrawer(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawer, setDrawer]);

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
      data-theme={themeId}
      style={{ '--hud-w': `${hudWidth}px`, '--wall-inset-l': `${wallInset.left}px`, '--wall-inset-r': `${wallInset.right}px` }}
    >
      <motion.div className="game-shake" animate={shake}>
        <div
          className="scene-canvas"
          style={{ ...canvas, '--wall-surface': `url('${wallArt.src}')`, '--wall-tile': wallArt.tile }}
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
          <RoomExtras scene={scene} extras={extras} best={best} />
          <AnimatePresence initial={false}>
            {scene.fx && <SceneFx key={scene.src} scene={scene} streak={streak} />}
          </AnimatePresence>
          <div className="scene-title" style={box(scene.regions.title)}>{title}</div>
        </div>
        <div className="scene-vignette" aria-hidden="true" />
      </motion.div>

      <div className="hud-top">
        {topBar({ collapsed })}
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

      {collapsed && (
        <BottomTabBar
          active={drawer}
          onRoutines={() => setDrawer((d) => (d === 'routines' ? null : 'routines'))}
          onCalendar={() => { setDrawer(null); onOpenCalendar(); }}
          onRecordAchievements={() => setDrawer((d) => (d === 'record' ? null : 'record'))}
        />
      )}
    </div>
  );
}
