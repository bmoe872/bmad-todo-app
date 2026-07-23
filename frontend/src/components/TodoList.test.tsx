import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getTodos } from '../api/todos';
import type { Todo } from '../types';
import { renderWithClient } from '../test-utils';
import { EMPTY_MESSAGE } from './EmptyState';
import { LOAD_ERROR_MESSAGE, RETRY_LABEL, TodoList } from './TodoList';

// Mock the API layer — no real network, no Postgres. The query hook still runs.
vi.mock('../api/todos');
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

/** A promise we resolve manually, to hold the query in its pending state. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  getTodosMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('TodoList states', () => {
  it('shows skeleton rows while the cold load is in flight, then resolves to the loaded list', async () => {
    const d = deferred<Todo[]>();
    getTodosMock.mockReturnValue(d.promise);

    renderWithClient(<TodoList />);

    // Loading: skeleton rows, no spinner, no textual loading copy.
    expect(screen.getByTestId('skeleton-rows')).toBeInTheDocument();
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();

    d.resolve([makeTodo({ description: 'call the dentist' })]);

    // Loaded: the row renders and the skeleton is gone.
    expect(await screen.findByText('call the dentist')).toBeInTheDocument();
    expect(screen.queryByTestId('skeleton-rows')).not.toBeInTheDocument();
  });

  it('renders rows in the exact server order (newest-first, not re-sorted client-side)', async () => {
    const newest = makeTodo({ description: 'newest', created_at: '2026-07-23T12:00:00Z' });
    const oldest = makeTodo({ description: 'oldest', created_at: '2026-07-01T09:00:00Z' });
    // Server already returns DESC; the client must preserve this order verbatim.
    getTodosMock.mockResolvedValue([newest, oldest]);

    renderWithClient(<TodoList />);

    const rows = await screen.findAllByTestId('todo-row');
    expect(rows.map((r) => r.textContent)).toEqual(['newest', 'oldest']);
  });

  it('shows the empty state with exact microcopy when the list resolves empty', async () => {
    getTodosMock.mockResolvedValue([]);

    renderWithClient(<TodoList />);

    expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument();
    expect(EMPTY_MESSAGE).toBe('Nothing to do — add something above.');
  });

  it('shows an inline "Couldn\'t load your list. Retry" on fetch failure and never crashes', async () => {
    getTodosMock.mockRejectedValue(new Error('boom'));

    renderWithClient(<TodoList />);

    expect(await screen.findByText(LOAD_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: RETRY_LABEL })).toBeInTheDocument();
    // Combined, the inline error reads exactly "Couldn't load your list. Retry".
    expect(screen.getByTestId('inline-error').textContent).toBe(
      "Couldn't load your list.Retry",
    );
  });

  it('Retry re-fetches and transitions from error to loaded', async () => {
    getTodosMock
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([makeTodo({ description: 'recovered todo' })]);

    renderWithClient(<TodoList />);

    const retry = await screen.findByRole('button', { name: RETRY_LABEL });
    expect(getTodosMock).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);

    expect(await screen.findByText('recovered todo')).toBeInTheDocument();
    await waitFor(() => expect(getTodosMock).toHaveBeenCalledTimes(2));
  });

  it('wraps a long description without truncating it', async () => {
    const long = 'x'.repeat(600);
    getTodosMock.mockResolvedValue([makeTodo({ description: long })]);

    renderWithClient(<TodoList />);

    const text = await screen.findByText(long);
    // Full content present (no truncation) and set to wrap, not clip.
    expect(text.textContent).toBe(long);
    expect(text.className).toContain('orbit-row__text');
  });

  it('renders HTML-like Todo text as escaped literal text (XSS-safe, no HTML interpolation)', async () => {
    const malicious = '<img src=x onerror="alert(1)">';
    getTodosMock.mockResolvedValue([makeTodo({ description: malicious })]);

    const { container } = renderWithClient(<TodoList />);

    // Rendered verbatim as text...
    expect(await screen.findByText(malicious)).toBeInTheDocument();
    // ...and never parsed into a real element.
    expect(container.querySelector('img')).toBeNull();
  });
});
