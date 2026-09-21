import { describe, it, expect } from 'vitest';
import { motionFor, randomiseMotion, isFixedScene } from './SceneFx';
import fx from '../data/sceneFx.json';

const SEED_A = 12345;
const SEED_B = 98765;

// One representative layer from the real data, so the tests exercise the
// shapes the app actually renders rather than a hand-made stub.
const dawn = fx.placements['portrait-dawn'];

describe('which scenes get re-rolled', () => {
  it('leaves the night scenes exactly as authored', () => {
    for (const key of ['landscape-night', 'portrait-night']) {
      expect(isFixedScene(key), key).toBe(true);
      expect(motionFor(key, dawn, SEED_A)).toBe(dawn);   // the same object
    }
  });

  it('re-rolls every other scene', () => {
    for (const key of ['landscape-day', 'landscape-dusk', 'portrait-dawn', 'portrait-day', 'portrait-dusk']) {
      expect(isFixedScene(key), key).toBe(false);
      expect(motionFor(key, dawn, SEED_A)).not.toBe(dawn);
    }
  });

  it('survives a missing key', () => {
    expect(isFixedScene(undefined)).toBe(false);
  });
});

describe('re-rolling the motion', () => {
  const rolled = randomiseMotion(dawn, SEED_A);

  it('keeps every layer and every sprite', () => {
    expect(Object.keys(rolled)).toEqual(Object.keys(dawn));
    for (const layer of Object.keys(dawn)) {
      expect(rolled[layer].length, layer).toBe(dawn[layer].length);
    }
  });

  it('never moves a sprite', () => {
    // build-scene-fx.py places these against a mask that keeps them off the
    // tally wall. Moving one here would throw that guarantee away.
    for (const layer of Object.keys(dawn)) {
      dawn[layer].forEach((it, i) => {
        const out = rolled[layer][i];
        expect(out.x, `${layer}[${i}].x`).toBe(it.x);
        expect(out.y, `${layer}[${i}].y`).toBe(it.y);
        expect(out.w, `${layer}[${i}].w`).toBe(it.w);
      });
    }
  });

  it('keeps the fields that are not motion', () => {
    for (const layer of Object.keys(dawn)) {
      dawn[layer].forEach((it, i) => {
        const out = rolled[layer][i];
        if (it.s !== undefined) expect(out.s).toBe(it.s);
        if (it.k !== undefined) expect(out.k).toBe(it.k);
        if (it.op !== undefined) expect(out.op).toBe(it.op);
        if (it.rise !== undefined) expect(out.rise).toBe(it.rise);
      });
    }
  });

  it('keeps every duration within a quarter of the authored one', () => {
    for (const layer of Object.keys(dawn)) {
      dawn[layer].forEach((it, i) => {
        if (typeof it.dur !== 'number') return;
        const out = rolled[layer][i].dur;
        expect(out, `${layer}[${i}]`).toBeGreaterThanOrEqual(it.dur * 0.75 - 1e-3);
        expect(out, `${layer}[${i}]`).toBeLessThanOrEqual(it.dur * 1.25 + 1e-3);
      });
    }
  });

  it('never produces a zero or negative duration', () => {
    for (const layer of Object.keys(dawn)) {
      for (const it of rolled[layer]) {
        if (typeof it.dur === 'number') expect(it.dur).toBeGreaterThan(0);
      }
    }
  });

  it('starts each sprite somewhere inside its own cycle', () => {
    for (const layer of Object.keys(dawn)) {
      for (const it of rolled[layer]) {
        if (typeof it.delay !== 'number') continue;
        expect(it.delay).toBeLessThanOrEqual(0);
        expect(it.delay).toBeGreaterThanOrEqual(-it.dur);
      }
    }
  });

  it('only ever picks a wander path that exists in the CSS', () => {
    for (const layer of Object.keys(dawn)) {
      for (const it of rolled[layer]) {
        if (typeof it.path !== 'number') continue;
        expect([0, 1, 2]).toContain(it.path);
      }
    }
  });

  it('gives the same result for the same seed', () => {
    expect(randomiseMotion(dawn, SEED_A)).toEqual(randomiseMotion(dawn, SEED_A));
  });

  it('gives a different result for a different seed', () => {
    const other = randomiseMotion(dawn, SEED_B);
    expect(JSON.stringify(other)).not.toBe(JSON.stringify(rolled));
  });

  it('actually changes the timings, rather than quietly copying them', () => {
    const before = dawn.clouds.map((c) => c.dur);
    const after = rolled.clouds.map((c) => c.dur);
    expect(after).not.toEqual(before);
  });

  it('never mutates the authored placements', () => {
    const snapshot = JSON.stringify(fx.placements['portrait-dawn']);
    randomiseMotion(fx.placements['portrait-dawn'], SEED_B);
    expect(JSON.stringify(fx.placements['portrait-dawn'])).toBe(snapshot);
  });

  it('leaves a layer that is not an array alone', () => {
    const odd = { meta: 'kept', things: [{ x: 1, y: 2, w: 3, dur: 10, delay: -1 }] };
    expect(randomiseMotion(odd, SEED_A).meta).toBe('kept');
  });

  it('handles an empty layer', () => {
    expect(randomiseMotion({ none: [] }, SEED_A).none).toEqual([]);
  });
});
