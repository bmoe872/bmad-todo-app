// Backdrop — the isolated, code-split three.js cube-star field (Stories 4.1 +
// 4.2, AD-8).
//
// Isolation contract (do not break):
//   - Fixed, full-viewport, `aria-hidden`, `pointer-events:none` layer BELOW the
//     panel (z-index 0 under the app's z-index 1). CSS lives in `.orbit-backdrop`.
//   - Reads NO Todo data, takes no data props, shares no state with the loop.
//   - Owns its <canvas> imperatively inside an effect; the three.js render loop
//     runs OUTSIDE React's render cycle (no per-frame re-render of the core UI).
//   - `three` is reached ONLY via a dynamic `import('./scene')`, so it is
//     code-split out of the entry bundle and mounts AFTER the loop is interactive.
//
// Degradation delivered here (host side of the AD-8 ladder; the frame-budget
// watchdog + context-loss recovery live in `scene.ts`):
//   - prefers-reduced-motion: reduce → render a single static frame, no loop.
//     ALSO responds if the OS setting is toggled at runtime (media-query change).
//   - No WebGL / context creation fails → swallow and leave the CSS
//     `surface-void → surface-void-far` gradient showing (the base fallback).
//   - Tab hidden (`visibilitychange`) → pause the loop; visible again → resume,
//     so a backgrounded tab burns no CPU/GPU.
//   - A synchronous / React-surfaced throw is caught by <BackdropBoundary> at the
//     mount point (App.tsx) → falls back to the static gradient, loop intact.

import { useEffect, useRef } from 'react';

import type { CubeStarField } from './scene';

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

type MotionListener = (event: MediaQueryListEvent) => void;

/** The reduced-motion MediaQueryList, or null where `matchMedia` is unavailable. */
function reducedMotionQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return null;
  return window.matchMedia(REDUCED_MOTION_QUERY);
}

function prefersReducedMotion(): boolean {
  return reducedMotionQuery()?.matches ?? false;
}

// Cross-browser change subscription. Modern browsers use addEventListener;
// older Safari (<14) only has the deprecated addListener. No-op if neither
// exists — the setting is then read once at mount and never throws.
function subscribeMotion(mql: MediaQueryList | null, fn: MotionListener): void {
  if (!mql) return;
  if (typeof mql.addEventListener === 'function') mql.addEventListener('change', fn);
  else if (typeof mql.addListener === 'function') mql.addListener(fn);
}

function unsubscribeMotion(mql: MediaQueryList | null, fn: MotionListener): void {
  if (!mql) return;
  if (typeof mql.removeEventListener === 'function') mql.removeEventListener('change', fn);
  else if (typeof mql.removeListener === 'function') mql.removeListener(fn);
}

export function Backdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let field: CubeStarField | null = null;
    // Mutable so the runtime reduced-motion toggle can flip it after mount.
    let staticOnly = prefersReducedMotion();
    const mql = reducedMotionQuery();

    const onResize = () => {
      if (!field) return;
      field.resize();
      if (staticOnly) field.renderStaticFrame();
    };

    // Pause the loop while the tab is hidden; resume when visible. Never touch
    // the field in static/reduced-motion mode (there is no loop to pause).
    const onVisibilityChange = () => {
      if (!field || staticOnly) return;
      if (document.visibilityState === 'hidden') field.stop();
      else field.start();
    };

    // Honor a runtime OS reduced-motion toggle: flip to a single static frame,
    // or resume the loop, without a reload.
    const onMotionChange = (event: MediaQueryListEvent) => {
      staticOnly = event.matches;
      if (!field) return;
      if (staticOnly) {
        field.stop();
        field.renderStaticFrame();
      } else {
        field.start();
      }
    };

    // Dynamic import = the code-split boundary that keeps `three` out of the
    // entry chunk. Fire-and-forget inside the effect so it never blocks paint.
    void import('./scene')
      .then(({ createCubeStarField }) => {
        // Effect may have been torn down before the chunk resolved (fast
        // unmount / StrictMode remount) — don't create a leaked scene.
        if (cancelled || !canvasRef.current) return;
        try {
          field = createCubeStarField(canvas);
          if (staticOnly) {
            field.renderStaticFrame(); // reduced motion: one frame, no loop
          } else {
            field.start();
          }
          window.addEventListener('resize', onResize);
          document.addEventListener('visibilitychange', onVisibilityChange);
          subscribeMotion(mql, onMotionChange);
        } catch {
          // No WebGL / context creation failed → leave the CSS gradient.
          field = null;
        }
      })
      .catch(() => {
        // Chunk failed to load → core loop is unaffected; gradient stays.
      });

    return () => {
      cancelled = true;
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      unsubscribeMotion(mql, onMotionChange);
      field?.dispose();
      field = null;
    };
  }, []);

  return (
    <div className="orbit-backdrop" aria-hidden="true" data-testid="backdrop">
      <canvas
        ref={canvasRef}
        data-testid="backdrop-canvas"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  );
}
