import { describe, it, expect } from 'vitest';
import { GUIDE_PAGES, roman } from './guide';
import { ICON_BITMAPS } from '../lib/achievements';

describe('the guide pages', () => {
  it('has enough pages to cover the app without becoming a manual', () => {
    expect(GUIDE_PAGES.length).toBeGreaterThanOrEqual(6);
    expect(GUIDE_PAGES.length).toBeLessThanOrEqual(10);
  });

  it('gives every page an id, a title, a lead and some points', () => {
    for (const page of GUIDE_PAGES) {
      expect(page.id, page.id).toBeTruthy();
      expect(page.title, page.id).toBeTruthy();
      expect(page.lead, page.id).toBeTruthy();
      expect(page.points.length, page.id).toBeGreaterThan(0);
    }
  });

  it('gives every page a unique id', () => {
    const ids = GUIDE_PAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only asks for icons that actually exist', () => {
    for (const page of GUIDE_PAGES) {
      expect(ICON_BITMAPS[page.icon], `${page.id} wants icon "${page.icon}"`).toBeDefined();
    }
  });

  it('keeps each point short enough to read on a phone', () => {
    for (const page of GUIDE_PAGES) {
      for (const point of page.points) {
        expect(point.length, `${page.id}: ${point}`).toBeLessThanOrEqual(140);
      }
    }
  });

  it('covers the things a new user cannot guess', () => {
    const text = JSON.stringify(GUIDE_PAGES).toLowerCase();
    for (const topic of ['tally', 'quest', 'streak', 'shield', 'xp', 'rally', 'export']) {
      expect(text, `guide never mentions ${topic}`).toContain(topic);
    }
  });

  it('tells the reader their data is only on this device', () => {
    const text = JSON.stringify(GUIDE_PAGES).toLowerCase();
    expect(text).toContain('device');
    expect(text).toMatch(/no account|no server/);
  });

  it('never scolds the reader', () => {
    const text = JSON.stringify(GUIDE_PAGES).toLowerCase();
    for (const word of ['lazy', 'you failed', 'don’t be', 'must not']) {
      expect(text).not.toContain(word);
    }
  });
});

describe('page numerals', () => {
  it('counts the way a page marker needs to', () => {
    expect(roman(1)).toBe('I');
    expect(roman(4)).toBe('IV');
    expect(roman(5)).toBe('V');
    expect(roman(8)).toBe('VIII');
    expect(roman(9)).toBe('IX');
    expect(roman(10)).toBe('X');
  });

  it('numbers every page the guide actually has', () => {
    for (let i = 1; i <= GUIDE_PAGES.length; i += 1) {
      expect(roman(i), `page ${i}`).toMatch(/^[IVX]+$/);
    }
  });
});
