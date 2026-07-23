// Deferred-commit + undo flow (AD-7), exercised end-to-end through App so the
// Footer, UndoToast, and useClearCompleted wiring are all covered together.
// FAKE TIMERS drive the ~6s auto-dismiss and hover-pause; the API layer is
// mocked so no real network / Postgres is touched.

import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { QueryClient } from '@tanstack/react-query';

import { clearCompleted, getTodos } from '../api/todos';
import { App } from '../App';
import { renderWithClient } from '../test-utils';
import type { Todo } from '../types';
import { CLEAR_UNDO_MS } from './useClearCompleted';
import { todosQueryKey } from './useTodos';

vi.mock('../api/todos');
const getTodosMock = vi.mocked(getTodos);
const clearCompletedMock = vi.mocked(clearCompleted);

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    description: 'a task',
    completed: false,
    created_at: '2026-07-23T15:04:05Z',
    ...overrides,
  };
}

/** Client pre-seeded with the List (staleTime: Infinity → no mount refetch). */
function seededClient(seed: Todo[]): QueryClient {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  client.setQueryData(todosQueryKey, seed);
  return client;
}

/** Flush the microtask queue so react-query promise chains settle. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  getTodosMock.mockReset();
  clearCompletedMock.mockReset();
  clearCompletedMock.mockResolvedValue({ deleted: 2 });
});

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe('Clear-completed deferred commit (AD-7)', () => {
  it('hides only completed rows optimistically and shows the toast — with NO server call yet', async () => {
    const seed = [
      makeTodo({ description: 'done one', completed: true }),
      makeTodo({ description: 'done two', completed: true }),
      makeTodo({ description: 'still active' }),
    ];
    getTodosMock.mockResolvedValue(seed);
    renderWithClient(<App />, seededClient(seed));

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));

    // Completed rows gone, active row stays put.
    expect(screen.queryByText('done one')).not.toBeInTheDocument();
    expect(screen.queryByText('done two')).not.toBeInTheDocument();
    expect(screen.getByText('still active')).toBeInTheDocument();

    // Toast shows the right count.
    expect(screen.getByText('Cleared 2 completed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    // No server call has fired.
    expect(clearCompletedMock).not.toHaveBeenCalled();
  });

  it('Undo restores the exact prior rows/order/state and makes NO network call', async () => {
    const seed = [
      makeTodo({ description: 'done one', completed: true }),
      makeTodo({ description: 'active a' }),
      makeTodo({ description: 'done two', completed: true }),
    ];
    getTodosMock.mockResolvedValue(seed);
    const client = seededClient(seed);
    renderWithClient(<App />, client);

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));
    expect(screen.queryByText('done one')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    // Every cleared Todo restored in its original position/state.
    expect(client.getQueryData<Todo[]>(todosQueryKey)).toEqual(seed);
    expect(screen.getByText('done one')).toBeInTheDocument();
    expect(screen.getByText('done two')).toBeInTheDocument();
    // Toast dismissed; no server call ever made.
    expect(screen.queryByTestId('undo-toast')).not.toBeInTheDocument();

    advance(CLEAR_UNDO_MS * 2);
    await flush();
    expect(clearCompletedMock).not.toHaveBeenCalled();
  });

  it('fires EXACTLY ONE DELETE /api/todos/completed with the captured id snapshot after ~6s', async () => {
    const doneA = makeTodo({ description: 'done a', completed: true });
    const doneB = makeTodo({ description: 'done b', completed: true });
    const seed = [doneA, makeTodo({ description: 'active' }), doneB];
    getTodosMock.mockResolvedValue([makeTodo({ description: 'active' })]);
    renderWithClient(<App />, seededClient(seed));

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));
    expect(clearCompletedMock).not.toHaveBeenCalled();

    advance(CLEAR_UNDO_MS);
    await flush();

    expect(clearCompletedMock).toHaveBeenCalledTimes(1);
    expect(clearCompletedMock).toHaveBeenCalledWith([doneA.id, doneB.id]);

    // Does not double-fire on further ticks.
    advance(CLEAR_UNDO_MS);
    await flush();
    expect(clearCompletedMock).toHaveBeenCalledTimes(1);
  });

  it('excludes a Todo completed AFTER the click from the snapshot', async () => {
    const doneA = makeTodo({ description: 'done a', completed: true });
    const doneB = makeTodo({ description: 'done b', completed: true });
    const active = makeTodo({ description: 'later done' });
    const seed = [doneA, doneB, active];
    getTodosMock.mockResolvedValue(seed);
    const client = seededClient(seed);
    renderWithClient(<App />, client);

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));

    // A third Todo becomes completed during the undo window (after the click).
    act(() => {
      client.setQueryData<Todo[]>(todosQueryKey, (prev) =>
        (prev ?? []).map((t) =>
          t.id === active.id ? { ...t, completed: true } : t,
        ),
      );
    });

    advance(CLEAR_UNDO_MS);
    await flush();

    // Only the original two ids are cleared; the late one is not.
    expect(clearCompletedMock).toHaveBeenCalledTimes(1);
    expect(clearCompletedMock).toHaveBeenCalledWith([doneA.id, doneB.id]);
  });

  it('pauses the auto-dismiss timer while the toast is hovered', async () => {
    const seed = [makeTodo({ description: 'done', completed: true })];
    getTodosMock.mockResolvedValue([]);
    clearCompletedMock.mockResolvedValue({ deleted: 1 });
    renderWithClient(<App />, seededClient(seed));

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));

    advance(3000); // partway through the window
    const toast = screen.getByTestId('undo-toast');
    fireEvent.mouseEnter(toast); // pause

    advance(CLEAR_UNDO_MS * 2); // would have fired if not paused
    await flush();
    expect(clearCompletedMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('undo-toast')).toBeInTheDocument();

    fireEvent.mouseLeave(toast); // resume (restarts the full window)
    advance(CLEAR_UNDO_MS);
    await flush();
    expect(clearCompletedMock).toHaveBeenCalledTimes(1);
  });

  it('on bulk-delete failure returns the cleared rows and shows an inline error', async () => {
    const doneA = makeTodo({ description: 'done a', completed: true });
    const doneB = makeTodo({ description: 'done b', completed: true });
    const seed = [doneA, doneB, makeTodo({ description: 'active' })];
    getTodosMock.mockResolvedValue(seed); // reconcile refetch returns true state
    clearCompletedMock.mockRejectedValue(new Error('boom'));
    const client = seededClient(seed);
    renderWithClient(<App />, client);

    fireEvent.click(screen.getByRole('button', { name: 'Clear completed' }));
    advance(CLEAR_UNDO_MS);
    await flush();

    expect(clearCompletedMock).toHaveBeenCalledTimes(1);
    // Cleared rows returned to their positions.
    expect(screen.getByText('done a')).toBeInTheDocument();
    expect(screen.getByText('done b')).toBeInTheDocument();
    // Non-blocking inline error surfaced.
    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't save that — try again.",
    );
    // Reconciled to server truth via a refetch.
    expect(getTodosMock).toHaveBeenCalled();
  });
});
