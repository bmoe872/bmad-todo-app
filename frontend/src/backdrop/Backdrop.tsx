// Backdrop mount point — CLEAN PLACEHOLDER for Epic 4 (Story 4.1).
//
// Story 3.1 deliberately ships NO three.js: no `three` import, no canvas, no
// animation, no requestAnimationFrame. This is just the fixed, aria-hidden,
// non-interactive layer that sits behind the panel and shows the plain
// `surface-void → surface-void-far` gradient (defined on <body> in global.css,
// which is also the no-WebGL fallback per AD-8).
//
// Story 4.1 replaces the body of this component with the code-split cube-star
// field, mounted after the core loop is interactive — without touching the
// loop or this element's isolation contract (fixed / aria-hidden / no pointer
// events / shares no state with components).

export function Backdrop() {
  return <div className="orbit-backdrop" aria-hidden="true" data-testid="backdrop" />;
}
