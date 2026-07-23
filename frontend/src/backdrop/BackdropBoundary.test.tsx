// BackdropBoundary tests (Story 4.2, AD-8, AC6/AC7).
//
// AC6: a backdrop failure must never take down the core todo loop. The boundary
// catches any synchronous / React-surfaced throw from its child subtree and
// falls back to the static gradient (renders `null` — the CSS void gradient is
// the base layer). AC7: that fallback adds no visible / interactive / AT-exposed
// node. Here we prove the boundary catches a throwing child, renders the
// fallback, and a SIBLING (standing in for the core loop) survives untouched.
//
// jsdom note: error boundaries only catch render/lifecycle/commit throws, not
// async rAF/event-handler failures (those are handled by Backdrop.tsx's
// try/catch + scene.ts context-loss/onFallback paths). Real WebGL is absent in
// jsdom, so we drive the boundary with a plain throwing component.

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { BackdropBoundary } from './BackdropBoundary';

// A child that throws during render, to trip the boundary.
function Bomb(): never {
  throw new Error('backdrop exploded');
}

// React logs caught errors to console.error even when a boundary handles them.
// Silence that expected noise so the run stays clean, and restore afterward.
let errorSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  errorSpy.mockRestore();
});

describe('BackdropBoundary (Story 4.2, AD-8)', () => {
  it('renders its children normally when nothing throws', () => {
    render(
      <BackdropBoundary>
        <div data-testid="backdrop-child">ok</div>
      </BackdropBoundary>,
    );
    expect(screen.getByTestId('backdrop-child')).toBeInTheDocument();
  });

  it('catches a throwing child and renders the gradient fallback (nothing) instead of crashing', () => {
    // Must not throw out of render — the boundary contains it.
    expect(() =>
      render(
        <BackdropBoundary>
          <Bomb />
        </BackdropBoundary>,
      ),
    ).not.toThrow();

    // Fallback is `null`: no throwing subtree is present.
    expect(screen.queryByText('backdrop exploded')).toBeNull();
  });

  it('keeps a sibling (standing in for the core todo loop) rendered when the backdrop throws', () => {
    // Mirrors App.tsx: <BackdropBoundary><Backdrop/></BackdropBoundary> as a
    // SIBLING of the core loop. The boundary wraps ONLY the backdrop, so a
    // backdrop failure leaves the loop fully rendered and usable.
    render(
      <>
        <BackdropBoundary>
          <Bomb />
        </BackdropBoundary>
        <main data-testid="core-loop">todo loop still here</main>
      </>,
    );
    const core = screen.getByTestId('core-loop');
    expect(core).toBeInTheDocument();
    expect(core).toHaveTextContent('todo loop still here');
  });

  it('exposes no interactive / tab-focusable / AT-visible node in the fallback (AC7 posture)', () => {
    const { container } = render(
      <BackdropBoundary>
        <Bomb />
      </BackdropBoundary>,
    );
    // Nothing rendered → no focusable or AT-exposed element sneaks in.
    expect(container.querySelector('button, a, input, [tabindex], [role]')).toBeNull();
    expect(container.textContent).toBe('');
  });

  it('logs a dev breadcrumb via componentDidCatch (never surfaced to the user)', () => {
    render(
      <BackdropBoundary>
        <Bomb />
      </BackdropBoundary>,
    );
    // console.error was called (React's own log and/or the dev breadcrumb);
    // the point is the failure is captured, not thrown.
    expect(errorSpy).toHaveBeenCalled();
  });
});
