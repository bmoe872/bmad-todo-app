import { screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryClient } from '@tanstack/react-query';

import { getTodos } from '../api/todos';
import { todosQueryKey } from '../hooks/useTodos';
import { renderWithClient } from '../test-utils';
import type { Todo } from '../types';
import { Footer, completedCountLabel } from './Footer';

vi.mock('../api/todos');
const getTodosMock = vi.mocked(getTodos);

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    description: 'a task',
    completed: false,
    created_at: '2026-07-23T15:04:05Z',
    ...overrides,
  };
}

/** A client pre-seeded with the List so useTodos resolves synchronously. */
function seededClient(seed: Todo[]): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
    },
  });
  client.setQueryData(todosQueryKey, seed);
  return client;
}

beforeEach(() => {
  getTodosMock.mockReset();
  getTodosMock.mockResolvedValue([]);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('completedCountLabel', () => {
  it('reads "No completed items" at zero and "N completed" otherwise', () => {
    expect(completedCountLabel(0)).toBe('No completed items');
    expect(completedCountLabel(1)).toBe('1 completed');
    expect(completedCountLabel(2)).toBe('2 completed');
  });
});

describe('Footer', () => {
  it('shows "No completed items" and NO Clear-completed button when zero completed', () => {
    const seed = [makeTodo({ description: 'active' })];
    renderWithClient(<Footer onClear={vi.fn()} />, seededClient(seed));

    expect(screen.getByText('No completed items')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear completed' }),
    ).not.toBeInTheDocument();
  });

  it('shows "N completed" in a polite aria-live region and the Clear button when completed exist', () => {
    const seed = [
      makeTodo({ description: 'done a', completed: true }),
      makeTodo({ description: 'done b', completed: true }),
      makeTodo({ description: 'active' }),
    ];
    renderWithClient(<Footer onClear={vi.fn()} />, seededClient(seed));

    const count = screen.getByText('2 completed');
    expect(count).toBeInTheDocument();
    expect(count).toHaveAttribute('aria-live', 'polite');
    expect(
      screen.getByRole('button', { name: 'Clear completed' }),
    ).toBeInTheDocument();
  });

  it('surfaces a non-blocking inline error when one is supplied', () => {
    const seed = [makeTodo({ completed: true })];
    renderWithClient(
      <Footer onClear={vi.fn()} error="Couldn't save that — try again." />,
      seededClient(seed),
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Couldn't save that — try again.");
  });
});
