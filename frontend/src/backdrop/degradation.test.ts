// Unit tests for the pure degradation-ladder decision logic (Story 4.2, AD-8).
//
// jsdom has no real WebGL/rAF timing, so the watchdog's DECISION is tested here
// as a pure function over simulated frame-time arrays — this is the AC5 coverage
// of the ordered step-down (DPR → count → static) and its hysteresis. Real
// ~60fps step-down on hardware is proven in Epic 6's performance pass (Story 6.3).

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_WATCHDOG_CONFIG,
  DEGRADATION_LADDER,
  FRAME_BUDGET_MS,
  MIN_DPR,
  nextDegradationStep,
  reducedCount,
  reducedDprCap,
  type WatchdogConfig,
} from './degradation';

// Small deterministic config so tests don't need 30-element arrays.
const cfg: WatchdogConfig = { budgetMs: FRAME_BUDGET_MS, tolerance: 1.5, sustainedFrames: 5 };
const OVER = FRAME_BUDGET_MS * cfg.tolerance + 5; // clearly over the miss threshold (~30ms)
const OK = FRAME_BUDGET_MS - 2; // comfortably within the ~16.7ms budget
const arr = (value: number, n: number) => Array.from({ length: n }, () => value);

describe('degradation ladder — order (AD-8)', () => {
  it('is exactly DPR → cube count → static', () => {
    expect(DEGRADATION_LADDER).toEqual(['reduce-dpr', 'reduce-count', 'fallback-static']);
  });
});

describe('nextDegradationStep — sustained-miss step-down', () => {
  it('holds when frames are healthy', () => {
    expect(nextDegradationStep({ stepsTaken: 0 }, arr(OK, cfg.sustainedFrames), cfg)).toBe('hold');
  });

  it('steps DPR first on a sustained miss', () => {
    expect(nextDegradationStep({ stepsTaken: 0 }, arr(OVER, cfg.sustainedFrames), cfg)).toBe(
      'reduce-dpr',
    );
  });

  it('steps cube count second (after DPR already reduced)', () => {
    expect(nextDegradationStep({ stepsTaken: 1 }, arr(OVER, cfg.sustainedFrames), cfg)).toBe(
      'reduce-count',
    );
  });

  it('falls back to static third (after DPR + count reduced)', () => {
    expect(nextDegradationStep({ stepsTaken: 2 }, arr(OVER, cfg.sustainedFrames), cfg)).toBe(
      'fallback-static',
    );
  });

  it('holds once the ladder is exhausted', () => {
    expect(nextDegradationStep({ stepsTaken: 3 }, arr(OVER, cfg.sustainedFrames), cfg)).toBe(
      'hold',
    );
  });
});

describe('nextDegradationStep — hysteresis (no over-reaction to spikes)', () => {
  it('does NOT step down on a single spike among healthy frames', () => {
    const frames = [...arr(OK, cfg.sustainedFrames - 1), OVER * 3];
    expect(nextDegradationStep({ stepsTaken: 0 }, frames, cfg)).toBe('hold');
  });

  it('does NOT step down until the miss is fully sustained across the window', () => {
    // One good frame inside the trailing window keeps us holding.
    const frames = [...arr(OVER, cfg.sustainedFrames - 1), OK];
    expect(nextDegradationStep({ stepsTaken: 0 }, frames, cfg)).toBe('hold');
  });

  it('holds until there are enough samples to judge a trend', () => {
    expect(nextDegradationStep({ stepsTaken: 0 }, arr(OVER, cfg.sustainedFrames - 1), cfg)).toBe(
      'hold',
    );
  });

  it('only inspects the trailing window (early good frames are ignored)', () => {
    const frames = [...arr(OK, 20), ...arr(OVER, cfg.sustainedFrames)];
    expect(nextDegradationStep({ stepsTaken: 0 }, frames, cfg)).toBe('reduce-dpr');
  });
});

describe('nextDegradationStep — default config sanity', () => {
  it('uses ~60fps budget and requires a real sustained window by default', () => {
    expect(DEFAULT_WATCHDOG_CONFIG.budgetMs).toBeCloseTo(1000 / 60);
    expect(DEFAULT_WATCHDOG_CONFIG.sustainedFrames).toBeGreaterThanOrEqual(10);
    // With the default (30-frame) window, a short over-budget burst still holds.
    expect(nextDegradationStep({ stepsTaken: 0 }, arr(OVER, 5))).toBe('hold');
  });
});

describe('reduced value helpers — floors respected before static', () => {
  it('halves the DPR cap but never below MIN_DPR', () => {
    expect(reducedDprCap(2)).toBe(1);
    expect(reducedDprCap(1)).toBe(MIN_DPR); // already at floor
    expect(reducedDprCap(0.5)).toBe(MIN_DPR); // never below floor
  });

  it('halves the visible count but never below the min ratio of the original', () => {
    expect(reducedCount(220, 220)).toBe(110);
    // Floor is ceil(25% of original) = 55; halving 100 → 50 would breach it, so clamp to 55.
    expect(reducedCount(100, 220)).toBe(55);
    expect(reducedCount(55, 220)).toBe(55); // stays at floor, never disappears
  });
});
