// Story 3.5 — cross-cutting accessibility, keyboard, and responsive assertions
// over the COMPOSED <App/>. This story hardens/unifies the per-component a11y
// shipped in 3.1–3.4 and proves the whole loop is keyboard-operable, correctly
// announced, and structurally responsive.
//
// jsdom limits (documented, deferred to Epic 6):
//  - jsdom does not lay out CSS or evaluate @media queries, so hover-hidden vs
//    always-visible delete, 200% zoom survival, and real viewport breakpoints
//    are asserted STRUCTURALLY (against the injected stylesheet text) here and
//    proven visually by axe/Playwright in Story 6.1 and the perf/a11y pass 6.3.
//  - jsdom does not implement sequential (Tab) focus navigation, so tab order is
//    asserted as DOM/reading order + "no positive tabindex" rather than by
//    simulating real Tab traversal.

import { screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Importing the stylesheets injects them into the jsdom document (vitest
// `css: true`) so the media-query-backed rules can be asserted as present.
import './styles/tokens.css';
import './styles/global.css';

import { getTodos } from './api/todos';
import { App } from './App';
import type { Todo } from './types';
import { renderWithClient } from './test-utils';

vi.mock('./api/todos');
const getTodosMock = vi.mocked(getTodos);

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    description: 'call the dentist',
    completed: false,
    created_at: '2026-07-23T15:04:05Z',
    ...overrides,
  };
}

/** Install a matchMedia stub reporting whether this is a fine-pointer device. */
function stubMatchMedia(desktop: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: desktop,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia;
}

function injectedCss(): string {
  return Array.from(document.querySelectorAll('style'))
    .map((s) => s.textContent ?? '')
    .join('\n');
}

beforeEach(() => {
  getTodosMock.mockReset();
  stubMatchMedia(false); // default: touch (no forced autofocus)
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('a11y — landmarks, roles, and labels on the composed screen (AC5)', () => {
  beforeEach(() => {
    getTodosMock.mockResolvedValue([
      makeTodo({ description: 'newest task' }),
      makeTodo({ description: 'older task' }),
    ]);
  });

  it('exposes the single screen as a <main> landmark', async () => {
    renderWithClient(<App />);
    await screen.findByRole('list');
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('labels the panel as a region titled "Todos" with an <h1>', async () => {
    renderWithClient(<App />);
    await screen.findByRole('list');
    // aria-labelledby="orbit-title" makes the <section> a labeled region.
    expect(screen.getByRole('region', { name: 'Todos' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Todos' })).toBeInTheDocument();
  });

  it('renders the List as a labeled list of listitem rows', async () => {
    renderWithClient(<App />);
    const list = await screen.findByRole('list', { name: 'Todos' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
  });

  it('exposes each row as a labeled checkbox whose name is the description', async () => {
    renderWithClient(<App />);
    await screen.findByRole('list');
    expect(screen.getByRole('checkbox', { name: 'newest task' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'older task' })).toBeInTheDocument();
  });

  it('gives the icon-only delete control an accessible name', async () => {
    renderWithClient(<App />);
    await screen.findByRole('list');
    const del = screen.getByRole('button', { name: 'Delete newest task' });
    expect(del.tagName).toBe('BUTTON');
    // The "×" glyph is CSS-drawn, so the button has no text content — the
    // accessible name comes only from aria-label (never color/glyph alone).
    expect(del.textContent).toBe('');
  });

  it('announces the completed count via a polite live region', async () => {
    getTodosMock.mockResolvedValue([
      makeTodo({ description: 'done thing', completed: true }),
      makeTodo({ description: 'todo thing', completed: false }),
    ]);
    renderWithClient(<App />);
    const count = await screen.findByText('1 completed');
    expect(count).toHaveAttribute('role', 'status');
    expect(count).toHaveAttribute('aria-live', 'polite');
  });
});

describe('a11y — keyboard reading order + no focus traps (AC1, AC2)', () => {
  beforeEach(() => {
    getTodosMock.mockResolvedValue([
      makeTodo({ description: 'newest task' }),
      makeTodo({ description: 'older task' }),
    ]);
  });

  it('lays interactive controls in reading order: input → (checkbox → delete)* → clear', async () => {
    getTodosMock.mockResolvedValue([
      makeTodo({ description: 'newest task', completed: true }),
      makeTodo({ description: 'older task', completed: false }),
    ]);
    renderWithClient(<App />);
    await screen.findByRole('list');

    // querySelectorAll returns document (reading) order — the tab order with no
    // positive tabindex overrides. This is the AC1 sequence.
    const controls = Array.from(
      document.querySelectorAll(
        '.orbit-add-input,[data-testid="todo-checkbox"],[data-testid="todo-delete"],.orbit-footer__clear',
      ),
    );
    const sequence = controls.map((el) => {
      if (el.classList.contains('orbit-add-input')) return 'add-input';
      if (el.getAttribute('data-testid') === 'todo-checkbox') {
        return `checkbox:${el.getAttribute('aria-labelledby')?.startsWith('todo-text') ? (el as HTMLElement).closest('.orbit-row')?.querySelector('.orbit-row__text')?.textContent : ''}`;
      }
      if (el.getAttribute('data-testid') === 'todo-delete') {
        return `delete:${el.getAttribute('aria-label')}`;
      }
      return 'clear';
    });

    expect(sequence).toEqual([
      'add-input',
      'checkbox:newest task',
      'delete:Delete newest task',
      'checkbox:older task',
      'delete:Delete older task',
      'clear',
    ]);
  });

  it('never forces tab order with a positive tabindex', async () => {
    renderWithClient(<App />);
    await screen.findByRole('list');
    const positive = Array.from(document.querySelectorAll('[tabindex]')).filter(
      (el) => Number(el.getAttribute('tabindex')) > 0,
    );
    expect(positive).toHaveLength(0);
  });

  it('keeps the Backdrop out of the tab order and hidden from assistive tech', async () => {
    renderWithClient(<App />);
    await screen.findByRole('list');
    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toBeEmptyDOMElement();
    expect(backdrop).not.toHaveAttribute('tabindex');
  });
});

describe('a11y — structural CSS: focus ring, reduced motion, responsive (AC1, AC7, AC8, AC9, AC10)', () => {
  it('applies a 2px focus-visible ring derived from the panel token (border-focus)', () => {
    const css = injectedCss();
    // The global :focus-visible rule uses the panel-derived focus token.
    expect(css).toMatch(/:focus-visible[^}]*outline:\s*2px[^}]*var\(--color-border-focus\)/);
  });

  it('reveals the hover-hidden delete on :focus-within so keyboard users reach it', () => {
    const css = injectedCss();
    // Hover-reveal is scoped to fine-pointer devices; focus-within keeps the
    // control keyboard-reachable there. Touch (hover:none) keeps it visible.
    expect(css).toContain('@media (hover: hover) and (pointer: fine)');
    expect(css).toMatch(/\.orbit-row:focus-within \.orbit-row__delete/);
  });

  it('drops micro-transitions to instant under prefers-reduced-motion (toast, row, skeleton)', () => {
    const css = injectedCss();
    const reducedBlocks = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g) ?? [];
    const joined = reducedBlocks.join('\n');
    expect(joined).toContain('.orbit-toast');
    expect(joined).toContain('.orbit-skeleton__row');
    // Row-level reveal/checkmark transitions also drop to instant.
    expect(joined).toMatch(/orbit-row__delete|orbit-row__check/);
  });

  it('caps the panel at 560px and lays out a single column (responsive frame)', () => {
    const css = injectedCss();
    // Panel width is 100% capped at the 560px max — centered on desktop, filling
    // the mobile width minus the app padding gutter.
    expect(css).toMatch(/\.orbit-panel[^}]*max-width:\s*var\(--panel-max-width\)/);
    const root = getComputedStyle(document.documentElement);
    expect(root.getPropertyValue('--panel-max-width').trim()).toBe('var(--space-panel-max)');
    expect(root.getPropertyValue('--space-panel-max').trim()).toBe('560px');
  });

  it('pins the toast to the bottom with a side gutter (near-full-width above the thumb zone)', () => {
    const css = injectedCss();
    expect(css).toMatch(/\.orbit-toast-layer[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.orbit-toast-layer[^}]*bottom:/);
    // The 16px side padding is the only gutter at 320px.
    expect(css).toMatch(/\.orbit-toast-layer[^}]*padding:\s*0\s*var\(--space-4\)/);
  });

  it('lets long descriptions wrap rather than force horizontal scroll (200% zoom safety)', () => {
    const css = injectedCss();
    expect(css).toMatch(/\.orbit-row__text[^}]*overflow-wrap:\s*anywhere/);
  });
});
