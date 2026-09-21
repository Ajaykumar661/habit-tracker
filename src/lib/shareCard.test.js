import { describe, it, expect, vi } from 'vitest';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('@capacitor/filesystem', () => ({ Filesystem: {}, Directory: {} }));
vi.mock('@capacitor/share', () => ({ Share: {} }));

const { tallyLayout, roomWindow, cardFilename, CARD } = await import('./shareCard');

const BOX = { x: 0, y: 0, w: 600, h: 800 };

describe('tally marks on the card', () => {
  it('groups marks in gates of five', () => {
    const t = tallyLayout(12, BOX);
    expect(t.gates.map((g) => g.n)).toEqual([5, 5, 2]);
    expect(t.shown).toBe(12);
    expect(t.extra).toBe(0);
  });

  it('fills rows of six gates, left to right', () => {
    const t = tallyLayout(35, BOX);
    expect(t.gates).toHaveLength(7);
    expect(t.gates[6].y).toBeGreaterThan(t.gates[0].y);
    expect(t.gates[6].x).toBe(t.gates[0].x);
  });

  it('never squeezes a long run smaller: the rest is counted, not drawn', () => {
    const t = tallyLayout(5000, BOX);
    expect(t.shown + t.extra).toBe(5000);
    expect(t.extra).toBeGreaterThan(0);
    for (const g of t.gates) expect(g.y + t.gh).toBeLessThanOrEqual(BOX.y + BOX.h);
  });

  it('draws nothing for day zero', () => {
    expect(tallyLayout(0, BOX).gates).toEqual([]);
  });
});

describe('the room in frame', () => {
  const scene = { width: 941, height: 1672, regions: { wall: { x: 225, y: 463, w: 488, h: 729 } } };

  it('fits the room to the card width', () => {
    expect(roomWindow(scene).scale).toBeCloseTo(CARD.w / 941);
  });

  it('keeps the tallest trophy on the shelf in frame', () => {
    const { top } = roomWindow(scene, 340);
    expect(top).toBeLessThanOrEqual(270);
  });

  it('never looks above the top of the room', () => {
    expect(roomWindow(scene, 5).top).toBe(0);
  });
});

describe('the file', () => {
  it('is named after the routine', () => {
    expect(cardFilename('DRINK 8 GLASSES')).toBe('tally-wall-drink-8-glasses.png');
    expect(cardFilename('')).toBe('tally-wall-wall.png');
  });
});
