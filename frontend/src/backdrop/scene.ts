// Isolated three.js cube-star field (Story 4.1, AD-8).
//
// This is the ONLY module in the app that imports `three`. The Backdrop
// component reaches it exclusively through a dynamic `import('./scene')`, so
// `three` is code-split into its own async chunk and never enters the entry
// bundle — the core todo loop paints and becomes interactive without it.
//
// The module is framework-free: no React, no app state, no Todo data. It owns
// a canvas imperatively and runs its own requestAnimationFrame loop OUTSIDE
// React's render cycle. It exposes a small handle so the component effect can
// start/stop/dispose it deterministically (no leaked loop, listener, or GPU
// context).
//
// Visual identity (DESIGN.md): cube "stars" drift slowly past over the
// transparent canvas (the CSS `surface-void → surface-void-far` gradient shows
// through and is the no-WebGL fallback). Near cubes read brighter/larger
// (star-cube #8FB2FF), far cubes dimmer/smaller (star-cube-dim #39456E), so the
// field reads as depth, not noise.
//
// Story 4.2 adds the runtime guardrails on top of the 4.1 field: an adaptive
// frame-budget watchdog that steps DOWN quality on sustained jank (DPR → cube
// count → static, via the pure decider in `degradation.ts`), and WebGL
// context-loss/restore handling. The ordered ladder and never-degrade-core
// invariant are AD-8; frame rate is always sacrificed before the core loop.

import * as THREE from 'three';

import {
  DEGRADATION_LADDER,
  nextDegradationStep,
  reducedCount,
  reducedDprCap,
  type WatchdogState,
} from './degradation';

export interface CubeStarField {
  /** Begin the animation loop (no-op if already running or if static). */
  start(): void;
  /** Pause the animation loop; keeps GPU resources alive. */
  stop(): void;
  /** Re-read the viewport size / DPR and resize the renderer + camera. */
  resize(): void;
  /** Render exactly one frame without starting the loop (static mode). */
  renderStaticFrame(): void;
  /** Cancel the loop and release ALL GPU resources + listeners. */
  dispose(): void;
}

export interface CubeStarOptions {
  /** Number of cube "stars". Kept modest for the calm, subtle look + perf. */
  count?: number;
  /** Initial cap on device-pixel-ratio; the watchdog steps this DOWN under jank. */
  maxPixelRatio?: number;
  /** Drift speed in world units per second (slow + calm). */
  driftSpeed?: number;
  /**
   * Called once the watchdog has exhausted the ladder and frozen the field to a
   * static frame, or when the WebGL context is lost and cannot be restored. The
   * host may ignore it — the CSS void gradient is always the base layer — but it
   * lets the React layer react (e.g. tidy state) if it wants to. Never throws.
   */
  onFallback?: () => void;
}

// Palette from tokens.css — bright (near) → dim (far).
const STAR_BRIGHT = new THREE.Color('#8fb2ff'); // --color-star-cube
const STAR_DIM = new THREE.Color('#39456e'); // --color-star-cube-dim

const FIELD_DEPTH = 60; // z-range the field wraps within
const NEAR_Z = 6; // cube recycles once it drifts past this toward the camera
const SPREAD_XY = 14; // half-width of the x/y scatter box

/**
 * Create the cube-star field bound to `canvas`. Throws if a WebGL context
 * cannot be created — the caller (Backdrop) catches this and leaves the CSS
 * gradient showing (no-WebGL fallback, AD-8).
 */
export function createCubeStarField(
  canvas: HTMLCanvasElement,
  options: CubeStarOptions = {},
): CubeStarField {
  const count = options.count ?? 220;
  const driftSpeed = options.driftSpeed ?? 1.6;
  const onFallback = options.onFallback;

  // DPR cap starts at the requested max and is lowered by the watchdog (step 1
  // of the ladder). `mesh.count` (below) is the visible-cube knob (step 2).
  let dprCap = options.maxPixelRatio ?? 2;

  // alpha:true keeps the canvas transparent so the void gradient shows through
  // and remains the fallback. antialias:false + low-power favor the core loop.
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: false,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0); // fully transparent

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 0, NEAR_Z);

  // One shared unit-cube geometry + one basic (unlit, cheap) material. Per-cube
  // color comes from the instanced color buffer; MeshBasicMaterial needs no
  // lights, keeping the frame trivial.
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

  // Per-cube state kept in plain arrays (avoid reading matrices back each frame).
  const posX = new Float32Array(count);
  const posY = new Float32Array(count);
  const posZ = new Float32Array(count);
  const sizes = new Float32Array(count);
  const spin = new Float32Array(count);

  const dummy = new THREE.Object3D();
  const tmpColor = new THREE.Color();

  const rand = (min: number, max: number) => min + Math.random() * (max - min);

  function placeCube(i: number, z: number) {
    posX[i] = rand(-SPREAD_XY, SPREAD_XY);
    posY[i] = rand(-SPREAD_XY, SPREAD_XY);
    posZ[i] = z;
    sizes[i] = rand(0.05, 0.42);
    spin[i] = rand(-0.4, 0.4);
  }

  function depthColor(i: number) {
    // Normalize depth: near (z close to NEAR_Z) → bright; far → dim.
    const t = THREE.MathUtils.clamp(
      (posZ[i] + FIELD_DEPTH) / (FIELD_DEPTH + NEAR_Z),
      0,
      1,
    );
    tmpColor.copy(STAR_DIM).lerp(STAR_BRIGHT, t);
    return tmpColor;
  }

  // Initial scatter across the full depth range.
  for (let i = 0; i < count; i++) {
    placeCube(i, rand(-FIELD_DEPTH, NEAR_Z));
    mesh.setColorAt(i, depthColor(i));
  }
  scene.add(mesh);

  function writeInstance(i: number) {
    dummy.position.set(posX[i], posY[i], posZ[i]);
    dummy.rotation.set(posZ[i] * 0.1, posZ[i] * 0.13, 0);
    dummy.scale.setScalar(sizes[i]);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  }

  for (let i = 0; i < count; i++) writeInstance(i);
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
    renderer.setSize(w, h, false);
    camera.aspect = h > 0 ? w / h : 1;
    camera.updateProjectionMatrix();
  }
  resize();

  let rafId = 0;
  let running = false;
  let lastT = 0;
  let contextLost = false;

  // --- Frame-budget watchdog (AD-8 degradation ladder) --------------------
  // `visibleCount` is the step-2 knob: lowering `mesh.count` draws fewer cubes
  // without reallocating buffers (capacity stays `count`). `dprCap` (above) is
  // step 1. `frameSamples` is a rolling window of recent frame durations (ms)
  // fed to the PURE decider; after each applied step we clear it so the change
  // is re-measured before the next step can fire.
  let visibleCount = count;
  const watchdog: WatchdogState = { stepsTaken: 0 };
  const frameSamples: number[] = [];
  const SAMPLE_CAP = 60;
  let lastFrameMs = 0;

  function applyDegradation(action: (typeof DEGRADATION_LADDER)[number]) {
    if (action === 'reduce-dpr') {
      dprCap = reducedDprCap(dprCap);
      resize();
    } else if (action === 'reduce-count') {
      visibleCount = reducedCount(visibleCount, count);
      mesh.count = visibleCount;
    } else {
      // 'fallback-static': stop animating and leave one frozen frame (the void
      // gradient still shows through). Never stutter; the core loop wins.
      stop();
      renderStaticFrame();
      onFallback?.();
    }
    watchdog.stepsTaken += 1;
    frameSamples.length = 0; // re-measure under the new setting before stepping again
  }

  function step(nowMs: number) {
    if (!running) return;
    const now = nowMs / 1000;
    const dt = lastT ? Math.min(now - lastT, 0.05) : 0.016;
    lastT = now;

    let colorsDirty = false;
    for (let i = 0; i < visibleCount; i++) {
      // Drift toward the camera (increasing z). Recycle to the far plane once
      // a cube passes NEAR_Z, so the field is infinite and cheap.
      posZ[i] += driftSpeed * dt;
      if (posZ[i] > NEAR_Z) {
        placeCube(i, -FIELD_DEPTH);
        mesh.setColorAt(i, depthColor(i));
        colorsDirty = true;
      }
      writeInstance(i);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty && mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    renderer.render(scene, camera);

    // Sample this frame's wall-clock duration and let the watchdog decide.
    // Skip the first frame (no previous timestamp → bogus delta).
    if (lastFrameMs) {
      frameSamples.push(nowMs - lastFrameMs);
      if (frameSamples.length > SAMPLE_CAP) frameSamples.shift();
      const decision = nextDegradationStep(watchdog, frameSamples);
      if (decision !== 'hold') {
        applyDegradation(decision);
        if (decision === 'fallback-static') {
          lastFrameMs = nowMs;
          return; // loop stopped inside applyDegradation; do not reschedule
        }
      }
    }
    lastFrameMs = nowMs;

    rafId = requestAnimationFrame(step);
  }

  function start() {
    if (running || contextLost) return;
    running = true;
    lastT = 0;
    lastFrameMs = 0;
    rafId = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function renderStaticFrame() {
    if (contextLost) return;
    renderer.render(scene, camera);
  }

  // --- WebGL context loss / restore (AD-8) --------------------------------
  // The GPU can yank the context at any time (driver reset, tab throttling,
  // power event). Preventing the default on `lost` lets the browser fire a
  // `restored` event; until then we stop cleanly so we never render into a dead
  // context. three's renderer re-initializes its GPU resources on restore.
  let wasRunningBeforeLoss = false;

  function handleContextLost(event: Event) {
    event.preventDefault();
    wasRunningBeforeLoss = running;
    contextLost = true;
    stop();
  }

  function handleContextRestored() {
    contextLost = false;
    resize();
    if (wasRunningBeforeLoss) {
      start();
    } else {
      renderStaticFrame();
    }
  }

  canvas.addEventListener('webglcontextlost', handleContextLost);
  canvas.addEventListener('webglcontextrestored', handleContextRestored);

  function dispose() {
    stop();
    // Remove our context listeners BEFORE forceContextLoss below, so our own
    // teardown-triggered `webglcontextlost` doesn't re-enter the handlers.
    canvas.removeEventListener('webglcontextlost', handleContextLost);
    canvas.removeEventListener('webglcontextrestored', handleContextRestored);
    geometry.dispose();
    material.dispose();
    // InstancedMesh disposes its own buffers via the renderer's info; drop it
    // from the scene and release the WebGL context.
    scene.remove(mesh);
    mesh.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }

  return { start, stop, resize, renderStaticFrame, dispose };
}
