// Pure, framework-free, three-free degradation-ladder decision logic (Story 4.2,
// AD-8). This module deliberately imports NOTHING (no `three`, no DOM) so it can
// live in the entry graph without dragging the WebGL library in, and so its
// decision logic is fully unit-testable under jsdom with simulated frame times.
//
// The frame-budget watchdog in `scene.ts` samples real per-frame durations and
// asks `nextDegradationStep` what to do. Degradation is MANDATORY and ORDERED
// (AD-8): step DOWN device-pixel-ratio first, then cube count, then stop the loop
// and fall back to a single static frame — never stutter, and never before a
// SUSTAINED budget miss (a single GC/resize spike must not collapse the field).
// Frame rate is always sacrificed before the core loop's interactivity.

/** Target per-frame budget for ~60fps (~16.67ms). */
export const FRAME_BUDGET_MS = 1000 / 60;

/** The ordered ladder actions. Order is fixed by AD-8 and must not change. */
export type DegradationAction = 'reduce-dpr' | 'reduce-count' | 'fallback-static';

/**
 * The ladder, highest-quality-preserving action first. The watchdog walks this
 * array one step at a time on each sustained budget miss: DPR → count → static.
 */
export const DEGRADATION_LADDER: readonly DegradationAction[] = [
  'reduce-dpr',
  'reduce-count',
  'fallback-static',
] as const;

export interface WatchdogState {
  /** Ladder steps already applied (0 = full quality; length = exhausted). */
  stepsTaken: number;
}

export interface WatchdogConfig {
  /** Per-frame budget in ms; frames slower than budget*tolerance are "misses". */
  budgetMs: number;
  /** Tolerance multiplier — ignore small overruns, react only to real jank. */
  tolerance: number;
  /** Consecutive over-budget frames required before stepping down (hysteresis). */
  sustainedFrames: number;
}

export const DEFAULT_WATCHDOG_CONFIG: WatchdogConfig = {
  budgetMs: FRAME_BUDGET_MS,
  // ~25ms: comfortably above the 60fps budget so a healthy-but-imperfect frame
  // is not treated as jank, but sustained sub-40fps rendering is.
  tolerance: 1.5,
  // ~0.5s of sustained jank at the 60fps target before we touch anything, so a
  // one-off spike (GC pause, resize, tab wake) never collapses the field.
  sustainedFrames: 30,
};

export type WatchdogDecision = DegradationAction | 'hold';

/**
 * Pure decision. Given the recent frame durations (most-recent last) and how
 * many ladder steps have already been applied, return the NEXT ladder action —
 * or `'hold'`.
 *
 * Steps down ONLY when the trailing `sustainedFrames` frames are ALL over
 * `budgetMs * tolerance` (sustained miss / hysteresis), never on a single spike.
 * Returns `'hold'` when frames are healthy or the ladder is exhausted. The
 * caller owns applying the action and incrementing `stepsTaken`.
 */
export function nextDegradationStep(
  state: WatchdogState,
  recentFrameMs: readonly number[],
  config: WatchdogConfig = DEFAULT_WATCHDOG_CONFIG,
): WatchdogDecision {
  // Ladder exhausted — already at the static fallback, nothing left to do.
  if (state.stepsTaken >= DEGRADATION_LADDER.length) return 'hold';

  const threshold = config.budgetMs * config.tolerance;
  const need = config.sustainedFrames;

  // Not enough samples yet to judge a sustained trend — hold.
  if (recentFrameMs.length < need) return 'hold';

  // Only a fully-sustained miss over the trailing window steps down.
  const windowFrames = recentFrameMs.slice(-need);
  const allOverBudget = windowFrames.every((ms) => ms > threshold);
  if (!allOverBudget) return 'hold';

  return DEGRADATION_LADDER[state.stepsTaken];
}

// --- Pure helpers for the concrete DPR / count values a step produces. --------
// The scene applies each ladder action exactly once; these keep the produced
// values (and their floors) testable without a GPU. A minimum DPR of 1 and a
// minimum visible-cube ratio guarantee the field stays coherent right up until
// the final static fallback, rather than degrading into an empty canvas.

export const MIN_DPR = 1;
export const MIN_COUNT_RATIO = 0.25;

/** DPR cap after a `reduce-dpr` step (floored at MIN_DPR). */
export function reducedDprCap(currentCap: number): number {
  return Math.max(MIN_DPR, currentCap * 0.5);
}

/** Visible cube count after a `reduce-count` step (floored relative to original). */
export function reducedCount(current: number, original: number): number {
  const floor = Math.max(1, Math.ceil(original * MIN_COUNT_RATIO));
  return Math.max(floor, Math.floor(current * 0.5));
}
