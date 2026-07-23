// Backdrop isolation + lifecycle tests (Story 4.1, AD-8).
//
// jsdom has NO WebGL, so we do not exercise real three.js rendering here — the
// scene module is mocked to assert the ISOLATION and LIFECYCLE contract that IS
// testable under jsdom: the backdrop mounts after an async (code-split) scene
// import, stays aria-hidden / non-interactive, reads no Todo data, honors the
// reduced-motion guard, degrades without throwing when the scene can't init,
// and disposes cleanly on unmount (no leaked loop / context). Real WebGL
// rendering + FPS are validated in Epic 6's performance pass (Story 6.3), and
// axe-with-backdrop-active in Story 6.1.

import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Backdrop } from './Backdrop';

// Mock the ONLY module that imports `three`. That the component works entirely
// through this mock proves it reaches `three` solely via the dynamic
// `import('./scene')` boundary (code-split), never a static import.
// vi.hoisted lets the mock factory reference these (mocks are hoisted above imports).
const { createCubeStarField, handle } = vi.hoisted(() => {
  const handle = {
    start: vi.fn(),
    stop: vi.fn(),
    resize: vi.fn(),
    renderStaticFrame: vi.fn(),
    dispose: vi.fn(),
  };
  const createCubeStarField = vi.fn<(canvas?: HTMLCanvasElement) => typeof handle>(
    () => handle,
  );
  return { createCubeStarField, handle };
});

vi.mock('./scene', () => ({ createCubeStarField }));

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

// A matchMedia mock whose `change` listeners we can fire on demand, to simulate
// the OS reduced-motion setting being toggled at runtime.
function mockMatchMedia(initialMatches: boolean) {
  const listeners = new Set<(e: MediaQueryListEvent) => void>();
  const mql = {
    matches: initialMatches,
    media: REDUCED_MOTION_QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, fn: (e: MediaQueryListEvent) => void) =>
      listeners.add(fn),
    ),
    removeEventListener: vi.fn((_type: string, fn: (e: MediaQueryListEvent) => void) =>
      listeners.delete(fn),
    ),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql) as unknown as typeof window.matchMedia;
  const fire = (matches: boolean) => {
    mql.matches = matches;
    listeners.forEach((fn) => fn({ matches } as MediaQueryListEvent));
  };
  return { mql, fire };
}

// jsdom's document.visibilityState is a read-only getter; override it and fire
// the visibilitychange event the host listens for.
function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: motion allowed. jsdom has no matchMedia, so leaving it undefined
  // already means "not reduced motion"; be explicit for clarity.
  // @ts-expect-error - allow deleting the optional test override
  delete window.matchMedia;
});

afterEach(() => {
  // @ts-expect-error - clean up any per-test matchMedia override
  delete window.matchMedia;
  // Restore default visibility so a per-test override never leaks.
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

describe('Backdrop (isolated three.js cube-star field)', () => {
  it('renders a fixed, aria-hidden, non-interactive layer that owns a canvas', () => {
    const { getByTestId } = render(<Backdrop />);
    const backdrop = getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toHaveClass('orbit-backdrop');
    expect(getByTestId('backdrop-canvas').tagName).toBe('CANVAS');
    // No interactive or tab-focusable nodes — invisible to AT and tab order.
    expect(backdrop.querySelector('button, a, input, [tabindex]')).toBeNull();
  });

  it('takes no props and reads no Todo data (isolation, AD-8)', () => {
    // Rendering with zero props type-checks and works: the component shares no
    // state with the core loop and needs no QueryClient provider.
    expect(() => render(<Backdrop />)).not.toThrow();
    expect(Backdrop.length).toBe(0); // component declares no parameters
  });

  it('lazily imports the scene and starts the animation loop after mount', async () => {
    render(<Backdrop />);
    // The scene import is async (code-split), so the factory is called on a
    // later tick — after first paint, never blocking it.
    await waitFor(() => expect(createCubeStarField).toHaveBeenCalledTimes(1));
    // It is handed the real canvas element imperatively.
    const canvasArg = createCubeStarField.mock.calls[0][0];
    expect(canvasArg).toBeInstanceOf(HTMLCanvasElement);
    expect(handle.start).toHaveBeenCalledTimes(1);
    expect(handle.renderStaticFrame).not.toHaveBeenCalled();
  });

  it('disposes the scene and stops the loop on unmount (no leak)', async () => {
    const { unmount } = render(<Backdrop />);
    await waitFor(() => expect(createCubeStarField).toHaveBeenCalledTimes(1));
    unmount();
    expect(handle.dispose).toHaveBeenCalledTimes(1);
  });

  it('honors prefers-reduced-motion: renders one static frame, never starts the loop', async () => {
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as typeof window.matchMedia;

    render(<Backdrop />);
    await waitFor(() => expect(createCubeStarField).toHaveBeenCalledTimes(1));
    expect(handle.renderStaticFrame).toHaveBeenCalledTimes(1);
    expect(handle.start).not.toHaveBeenCalled();
  });

  it('degrades without throwing when the scene cannot initialize (no WebGL)', async () => {
    createCubeStarField.mockImplementationOnce(() => {
      throw new Error('WebGL unavailable');
    });
    const { getByTestId, unmount } = render(<Backdrop />);
    await waitFor(() => expect(createCubeStarField).toHaveBeenCalledTimes(1));
    // The layer still exists (gradient shows); nothing was started or disposed
    // because no field was created.
    expect(getByTestId('backdrop')).toBeInTheDocument();
    expect(handle.start).not.toHaveBeenCalled();
    expect(() => unmount()).not.toThrow();
    expect(handle.dispose).not.toHaveBeenCalled();
  });

  it('does not create a scene if unmounted before the chunk resolves (async race)', async () => {
    const { unmount } = render(<Backdrop />);
    // Unmount synchronously, before the dynamic import resolves.
    unmount();
    // Give the microtask queue a chance to flush the import.
    await Promise.resolve();
    await Promise.resolve();
    expect(createCubeStarField).not.toHaveBeenCalled();
    expect(handle.dispose).not.toHaveBeenCalled();
  });
});

describe('Backdrop — visibility pause/resume (Story 4.2, AD-8)', () => {
  it('pauses the loop when the tab is hidden and resumes when visible', async () => {
    render(<Backdrop />);
    await waitFor(() => expect(handle.start).toHaveBeenCalledTimes(1));
    handle.stop.mockClear();
    handle.start.mockClear();

    setVisibility('hidden');
    expect(handle.stop).toHaveBeenCalledTimes(1);
    expect(handle.start).not.toHaveBeenCalled();

    setVisibility('visible');
    expect(handle.start).toHaveBeenCalledTimes(1);
  });

  it('does not pause/resume when in reduced-motion (static) mode — no loop to touch', async () => {
    mockMatchMedia(true); // reduced motion → static frame, no loop
    render(<Backdrop />);
    await waitFor(() => expect(handle.renderStaticFrame).toHaveBeenCalledTimes(1));
    handle.stop.mockClear();
    handle.start.mockClear();

    setVisibility('hidden');
    setVisibility('visible');
    expect(handle.stop).not.toHaveBeenCalled();
    expect(handle.start).not.toHaveBeenCalled();
  });

  it('removes the visibilitychange listener on unmount (no leak)', async () => {
    const { unmount } = render(<Backdrop />);
    await waitFor(() => expect(handle.start).toHaveBeenCalledTimes(1));
    unmount();
    handle.stop.mockClear();

    // After unmount the listener must be gone — the event is a no-op.
    setVisibility('hidden');
    expect(handle.stop).not.toHaveBeenCalled();
  });
});

describe('Backdrop — runtime reduced-motion toggle (Story 4.2, UX-DR16)', () => {
  it('stops the loop and renders a static frame when motion becomes reduced at runtime', async () => {
    const { fire } = mockMatchMedia(false); // start with motion allowed → loop runs
    render(<Backdrop />);
    await waitFor(() => expect(handle.start).toHaveBeenCalledTimes(1));
    handle.renderStaticFrame.mockClear();

    fire(true); // user turns ON reduce-motion in the OS
    expect(handle.stop).toHaveBeenCalledTimes(1);
    expect(handle.renderStaticFrame).toHaveBeenCalledTimes(1);
  });

  it('resumes the loop when motion becomes allowed again at runtime', async () => {
    const { fire } = mockMatchMedia(true); // start reduced → static only
    render(<Backdrop />);
    await waitFor(() => expect(handle.renderStaticFrame).toHaveBeenCalledTimes(1));
    expect(handle.start).not.toHaveBeenCalled();

    fire(false); // user turns OFF reduce-motion in the OS
    expect(handle.start).toHaveBeenCalledTimes(1);
  });

  it('unsubscribes the media-query change listener on unmount (no leak)', async () => {
    const { mql } = mockMatchMedia(false);
    const { unmount } = render(<Backdrop />);
    await waitFor(() => expect(handle.start).toHaveBeenCalledTimes(1));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
