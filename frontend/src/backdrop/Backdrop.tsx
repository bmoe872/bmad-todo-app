// Backdrop — the isolated, code-split three.js cube-star field (Story 4.1, AD-8).
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
// Degradation delivered here (the FULL ordered ladder — watchdog, visibility
// pause, error boundary — is Story 4.2):
//   - prefers-reduced-motion: reduce → render a single static frame, no loop.
//   - No WebGL / context creation fails → swallow and leave the CSS
//     `surface-void → surface-void-far` gradient showing (the base fallback).

import { useEffect, useRef } from 'react';

import type { CubeStarField } from './scene';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function Backdrop() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let field: CubeStarField | null = null;
    const staticOnly = prefersReducedMotion();

    const onResize = () => {
      if (!field) return;
      field.resize();
      if (staticOnly) field.renderStaticFrame();
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
