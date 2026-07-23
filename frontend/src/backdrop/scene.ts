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
// field reads as depth, not noise. Density/DPR here use static, conservative
// caps; the adaptive frame-budget watchdog and the full degradation ladder are
// Story 4.2.

import * as THREE from 'three';

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
  /** Cap on device-pixel-ratio (static guardrail; adaptive step-down is 4.2). */
  maxPixelRatio?: number;
  /** Drift speed in world units per second (slow + calm). */
  driftSpeed?: number;
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
  const maxPixelRatio = options.maxPixelRatio ?? 2;
  const driftSpeed = options.driftSpeed ?? 1.6;

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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    renderer.setSize(w, h, false);
    camera.aspect = h > 0 ? w / h : 1;
    camera.updateProjectionMatrix();
  }
  resize();

  let rafId = 0;
  let running = false;
  let lastT = 0;

  function step(nowMs: number) {
    if (!running) return;
    const now = nowMs / 1000;
    const dt = lastT ? Math.min(now - lastT, 0.05) : 0.016;
    lastT = now;

    let colorsDirty = false;
    for (let i = 0; i < count; i++) {
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
    rafId = requestAnimationFrame(step);
  }

  function start() {
    if (running) return;
    running = true;
    lastT = 0;
    rafId = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  function renderStaticFrame() {
    renderer.render(scene, camera);
  }

  function dispose() {
    stop();
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
