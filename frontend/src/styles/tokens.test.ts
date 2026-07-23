import { describe, expect, it } from 'vitest';

// Importing the token stylesheets injects them into the jsdom document (vitest
// `css: true`), so we can assert the Orbit tokens are actually APPLIED — the
// single source of visual truth — and that the theme is dark-only.
import './global.css';
import './tokens.css';

function injectedCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
}

// The 18 colour tokens from DESIGN.md front-matter, resolved on :root.
const COLOR_TOKENS: Record<string, string> = {
  '--color-surface-void': '#070a14',
  '--color-surface-void-far': '#0b1020',
  '--color-surface-scrim': '#0e1324',
  '--color-surface-raised': '#161c31',
  '--color-surface-raised-hover': '#1e2540',
  '--color-ink-primary': '#eef1fa',
  '--color-ink-secondary': '#a7afc8',
  '--color-ink-completed': '#727c99',
  '--color-ink-disabled': '#525a74',
  '--color-accent': '#7aa8ff',
  '--color-accent-strong': '#9cc0ff',
  '--color-accent-ink': '#07122b',
  '--color-border-hairline': '#242b45',
  '--color-border-focus': '#9cc0ff',
  '--color-danger': '#ff8a8a',
  '--color-danger-ink': '#2a0e0e',
  '--color-star-cube': '#8fb2ff',
  '--color-star-cube-dim': '#39456e',
};

describe('design tokens (dark-only, applied as the single source of visual truth)', () => {
  it('resolves all 18 Orbit colour tokens on :root to their exact DESIGN.md values', () => {
    const root = getComputedStyle(document.documentElement);
    for (const [name, value] of Object.entries(COLOR_TOKENS)) {
      expect(root.getPropertyValue(name).trim()).toBe(value);
    }
  });

  it('resolves the Inter+system-ui family and the type/spacing/radius/panel scales', () => {
    const root = getComputedStyle(document.documentElement);
    expect(root.getPropertyValue('--font-family-base')).toContain('Inter');
    expect(root.getPropertyValue('--font-family-base')).toContain('system-ui');
    expect(root.getPropertyValue('--type-title-size').trim()).toBe('22px');
    expect(root.getPropertyValue('--radius-lg').trim()).toBe('20px');
    expect(root.getPropertyValue('--space-panel-max').trim()).toBe('560px');
    expect(root.getPropertyValue('--panel-bg-opacity').trim()).toBe('0.72');
  });

  it('is dark-only: declares color-scheme dark and NO light-theme variant', () => {
    const css = injectedCss();
    expect(css).toContain('color-scheme: dark');
    // No prefers-color-scheme media query and no data-theme/light-class hook.
    expect(css).not.toMatch(/@media[^{]*prefers-color-scheme/i);
    expect(css.toLowerCase()).not.toContain('data-theme');
    expect(css.toLowerCase()).not.toContain('theme-light');
  });
});
