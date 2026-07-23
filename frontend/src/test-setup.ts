// Vitest global setup: registers jest-dom matchers (e.g. toBeInTheDocument).
import '@testing-library/jest-dom/vitest';

// jsdom does not implement HTMLCanvasElement.getContext and logs a noisy
// "Not implemented" error the first time three.js probes for a WebGL context.
// Stub it to return null — this is exactly the no-WebGL environment the Backdrop
// must degrade against (Story 4.1 / AD-8): three.js throws a clean
// "Error creating WebGL context", the Backdrop catches it and leaves the CSS
// void gradient showing. Keeps the no-WebGL fallback deterministic and the test
// output clean without pulling in the native `canvas` package.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
}
