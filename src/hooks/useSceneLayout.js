import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const TOP_BAR = 58;   // px reserved for the top HUD bar
const MARGIN = 14;
const HUD_MIN = 215;  // below this a side panel collapses into a drawer
const HUD_MAX = 270;
const NARROW = 700;
const TAB_BAR_H = 86;  // reserved above the mobile bottom tab bar (incl. a home-indicator allowance)

// Works out where the room sits on screen and where each HUD zone goes.
// The room is scaled to COVER the viewport (cropping naturally), then
// shifted so the wall — not the image centre — is the focal point. Because
// every HUD position is derived from where the wall actually lands, the
// side panels and action bar can never be laid over the stone.
export function computeSceneLayout(scene, vw, vh, bottomH) {
  const { width: W, height: H, regions: { wall } } = scene;
  const narrow = vw < NARROW;
  // On mobile a fixed tab bar (BottomTabBar.jsx) sits below everything else
  // in the HUD — reserve its height so the wall centring and bottomTop clamp
  // never let the day/actions/quote group sit underneath it.
  const usableVh = narrow ? vh - TAB_BAR_H : vh;

  // Always cover — the room fills the screen at every size. On a portrait
  // phone that runs the wall off both edges; the stone still registers with
  // the art, and the tally marks are laid out inside the visible part only
  // (wallInset below).
  const scale = Math.max(vw / W, vh / H);
  const cw = W * scale;
  const ch = H * scale;

  // Wall centred horizontally, and vertically between the top bar and the
  // bottom HUD — then clamped so a covering room never shows a gap.
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  let left = vw / 2 - (wall.x + wall.w / 2) * scale;
  let top = (TOP_BAR + (usableVh - bottomH - MARGIN)) / 2 - (wall.y + wall.h / 2) * scale;
  if (cw >= vw) left = clamp(left, vw - cw, 0);
  if (ch >= vh) top = clamp(top, vh - ch, 0);

  const wallRect = {
    left: left + wall.x * scale,
    top: top + wall.y * scale,
    width: wall.w * scale,
    height: wall.h * scale,
  };
  wallRect.right = wallRect.left + wallRect.width;
  wallRect.bottom = wallRect.top + wallRect.height;

  const side = Math.min(wallRect.left, vw - wallRect.right) - 2 * MARGIN;
  const wallInset = {
    left: Math.max(0, -wallRect.left + MARGIN),
    right: Math.max(0, wallRect.right - vw + MARGIN),
  };
  const bottomMaxWidth = Math.min(vw - 2 * MARGIN, Math.max(300, wallRect.width));
  const collapsed = narrow || side < HUD_MIN;

  return {
    canvas: { left, top, width: cw, height: ch },
    wallRect,
    wallInset,
    bottomMaxWidth,
    collapsed,
    narrow,
    hudWidth: Math.min(HUD_MAX, Math.max(HUD_MIN, side)),
    // directly under the wall; pulled up only if the viewport is too short
    bottomTop: Math.max(TOP_BAR, Math.min(wallRect.bottom + MARGIN, usableVh - bottomH - MARGIN)),
    bottomCenter: wallRect.left + wallRect.width / 2,
  };
}

// clientWidth, not innerWidth: the page scrolls (data view below), and
// innerWidth counts the scrollbar — which would shift the right HUD ~10px
// toward the wall.
function viewport() {
  const el = document.documentElement;
  return { vw: el.clientWidth, vh: el.clientHeight };
}

// Standalone width check, independent of any particular scene — used to
// pick landscape vs. portrait artwork *before* a scene is chosen (GameView
// needs to know which room frame it's laying out before it can call
// computeSceneLayout with it).
export function useIsNarrowViewport() {
  const [narrow, setNarrow] = useState(() => viewport().vw < NARROW);
  useEffect(() => {
    const ro = new ResizeObserver(() => setNarrow(viewport().vw < NARROW));
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);
  return narrow;
}

export function useSceneLayout(scene) {
  const [size, setSize] = useState(viewport);
  const [bottomH, setBottomH] = useState(0);
  const bottomRef = useRef(null);

  // Observe the root element rather than listening for window resize: the
  // scrollbar appears after first render (once the data view mounts) and
  // narrows clientWidth without any resize event.
  useEffect(() => {
    const ro = new ResizeObserver(() => setSize(viewport()));
    ro.observe(document.documentElement);
    return () => ro.disconnect();
  }, []);

  // The bottom HUD's height (quote length varies) feeds back into where the
  // wall is centred, so measure it rather than guessing.
  useLayoutEffect(() => {
    const el = bottomRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(() => setBottomH(el.offsetHeight));
    ro.observe(el);
    setBottomH(el.offsetHeight);
    return () => ro.disconnect();
  }, []);

  return { layout: computeSceneLayout(scene, size.vw, size.vh, bottomH), bottomRef };
}
