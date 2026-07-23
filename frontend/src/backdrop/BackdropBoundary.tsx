// BackdropBoundary — the React error boundary that makes a Backdrop failure
// un-catastrophic (Story 4.2, AD-8, FR-7).
//
// AD-8: "An error boundary wraps the backdrop and falls back to the static
// gradient, so a backdrop failure can never take down the loop." The core todo
// loop lives in a SIBLING subtree (App's <main>), so catching here contains any
// backdrop-subtree error without touching the loop.
//
// The fallback is intentionally NOTHING: the CSS `surface-void → surface-void-far`
// radial gradient on `body`/`.orbit-backdrop` is always the base layer, so
// rendering `null` IS the static-gradient fallback — no visible, interactive, or
// assistive-tech-exposed node is added (the accessibility posture holds).
//
// Scope note (React limitation): error boundaries catch errors thrown during a
// child's render / lifecycle / commit — NOT errors thrown asynchronously inside
// the rAF loop or DOM event handlers. Those async scene failures are handled by
// the try/catch + context-loss/onFallback paths in Backdrop.tsx / scene.ts. This
// boundary is the backstop for synchronous / React-surfaced throws.

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface BackdropBoundaryProps {
  children: ReactNode;
}

interface BackdropBoundaryState {
  failed: boolean;
}

export class BackdropBoundary extends Component<BackdropBoundaryProps, BackdropBoundaryState> {
  state: BackdropBoundaryState = { failed: false };

  static getDerivedStateFromError(): BackdropBoundaryState {
    // Swallow the error and drop to the gradient fallback (render null).
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Dev-only breadcrumb; never surfaced to the user. In production this stays
    // silent so a decorative-layer failure is invisible.
    if (import.meta.env?.DEV) {
      console.error('Backdrop failed; falling back to the static gradient.', error, info);
    }
  }

  render(): ReactNode {
    // On failure render nothing — the void gradient behind the app IS the
    // fallback. Otherwise render the backdrop subtree unchanged.
    return this.state.failed ? null : this.props.children;
  }
}
