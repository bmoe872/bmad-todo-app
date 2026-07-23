import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTodos } from './api/todos';
import { App } from './App';
import { renderWithClient } from './test-utils';

vi.mock('./api/todos');
const getTodosMock = vi.mocked(getTodos);

beforeEach(() => {
  getTodosMock.mockReset();
  // Keep the query pending so App renders its frame deterministically.
  getTodosMock.mockReturnValue(new Promise(() => {}));
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('App shell', () => {
  it('renders the Orbit panel with the "Todos" title', () => {
    renderWithClient(<App />);
    expect(screen.getByRole('heading', { name: 'Todos' })).toBeInTheDocument();
  });

  it('never shows login, signup, or onboarding (FR-4)', () => {
    renderWithClient(<App />);
    expect(screen.queryByText(/log ?in|sign ?up|sign ?in|onboard|get started/i)).toBeNull();
  });

  it('renders the panel frame (add-input slot) and the backdrop mount even during load', () => {
    renderWithClient(<App />);
    expect(screen.getByTestId('add-input-slot')).toBeInTheDocument();
    expect(screen.getByTestId('skeleton-rows')).toBeInTheDocument();
  });

  it('mounts the backdrop as an aria-hidden, non-interactive placeholder (no three.js)', () => {
    renderWithClient(<App />);
    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    expect(backdrop).toBeEmptyDOMElement();
  });
});
