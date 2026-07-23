import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError } from '../api/client';
import { deleteTodo, getTodos, toggleTodo } from '../api/todos';
import type { Todo } from '../types';
import { renderWithClient } from '../test-utils';
import { TodoList } from './TodoList';
import { ACTION_ERROR_MESSAGE } from './TodoRow';

// Mock the API layer — no real network, no Postgres. The query + mutations run.
vi.mock('../api/todos');
const getTodosMock = vi.mocked(getTodos);
const toggleTodoMock = vi.mocked(toggleTodo);
const deleteTodoMock = vi.mocked(deleteTodo);

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    description: 'call the dentist',
    completed: false,
    created_at: '2026-07-23T15:04:05Z',
    ...overrides,
  };
}

// A mutable "server" the mocked API reads/writes, so optimistic writes and the
// onSettled reconcile refetch land on the same truth (no flaky re-add/re-remove).
let store: Todo[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  store = [];
  getTodosMock.mockImplementation(() => Promise.resolve(store.map((t) => ({ ...t }))));
  toggleTodoMock.mockImplementation((id: string, completed: boolean) => {
    store = store.map((t) => (t.id === id ? { ...t, completed } : t));
    return Promise.resolve({ ...store.find((t) => t.id === id)! });
  });
  deleteTodoMock.mockImplementation((id: string) => {
    store = store.filter((t) => t.id !== id);
    return Promise.resolve();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

/** Render TodoList seeded from `store` and wait for the rows to appear. */
async function renderList() {
  const utils = renderWithClient(<TodoList />);
  await screen.findAllByTestId('todo-row');
  return utils;
}

describe('TodoRow — toggle in place', () => {
  it('toggles an active Todo to completed optimistically and restyles in place (checked + completed cue)', async () => {
    const todo = makeTodo({ description: 'call the dentist', completed: false });
    store = [todo];
    await renderList();

    const checkbox = screen.getByRole('checkbox', { name: 'call the dentist' });
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);

    // Optimistic: the checkbox and the completed cue flip immediately.
    await waitFor(() => expect(checkbox).toBeChecked());
    expect(screen.getByTestId('todo-row')).toHaveAttribute('data-completed', 'true');
    expect(toggleTodoMock).toHaveBeenCalledWith(todo.id, true);
  });

  it('toggles a completed Todo back to active (both directions)', async () => {
    const todo = makeTodo({ description: 'water plants', completed: true });
    store = [todo];
    await renderList();

    const checkbox = screen.getByRole('checkbox', { name: 'water plants' });
    expect(checkbox).toBeChecked();

    fireEvent.click(checkbox);

    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.getByTestId('todo-row')).toHaveAttribute('data-completed', 'false');
    expect(toggleTodoMock).toHaveBeenCalledWith(todo.id, false);
  });

  it('never reorders the list when a Todo is toggled (stays in place)', async () => {
    const newest = makeTodo({ description: 'newest', created_at: '2026-07-23T12:00:00Z' });
    const oldest = makeTodo({ description: 'oldest', created_at: '2026-07-01T09:00:00Z' });
    store = [newest, oldest]; // server order, newest-first
    await renderList();

    const before = screen.getAllByTestId('todo-row').map((r) => r.textContent);
    expect(before).toEqual(['newest', 'oldest']);

    // Complete the NEWEST (top) item.
    fireEvent.click(screen.getByRole('checkbox', { name: 'newest' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'newest' })).toBeChecked(),
    );
    // Let the reconcile refetch settle, then assert order is unchanged.
    await waitFor(() => expect(getTodosMock).toHaveBeenCalledTimes(2));

    const after = screen.getAllByTestId('todo-row').map((r) => r.textContent);
    expect(after).toEqual(['newest', 'oldest']);
  });

  it('rolls back and shows an inline action error when a toggle fails', async () => {
    const todo = makeTodo({ description: 'file taxes', completed: false });
    store = [todo];
    await renderList();

    toggleTodoMock.mockRejectedValueOnce(new Error('boom')); // server rejects; store untouched

    const checkbox = screen.getByRole('checkbox', { name: 'file taxes' });
    fireEvent.click(checkbox);

    // Reverts in place to prior (active) state and surfaces the exact microcopy.
    expect(await screen.findByText(ACTION_ERROR_MESSAGE)).toBeInTheDocument();
    await waitFor(() => expect(checkbox).not.toBeChecked());
    expect(screen.getByTestId('todo-row')).toHaveAttribute('data-completed', 'false');
  });
});

describe('TodoRow — delete', () => {
  it('removes the row optimistically and calls DELETE', async () => {
    const todo = makeTodo({ description: 'cancel subscription' });
    store = [todo];
    await renderList();

    fireEvent.click(screen.getByRole('button', { name: 'Delete cancel subscription' }));

    await waitFor(() => expect(screen.queryByTestId('todo-row')).not.toBeInTheDocument());
    expect(deleteTodoMock).toHaveBeenCalledWith(todo.id);
  });

  it('reappears in place with an inline error when the delete fails', async () => {
    const todo = makeTodo({ description: 'renew passport' });
    store = [todo];
    await renderList();

    deleteTodoMock.mockRejectedValueOnce(new Error('boom')); // server rejects; store keeps it

    fireEvent.click(screen.getByRole('button', { name: 'Delete renew passport' }));

    // Row comes back (rollback + reconcile) and the inline error shows.
    expect(await screen.findByText(ACTION_ERROR_MESSAGE)).toBeInTheDocument();
    expect(screen.getByText('renew passport')).toBeInTheDocument();
  });

  it('treats a 404 on delete as already-gone: row stays removed, no error', async () => {
    const todo = makeTodo({ description: 'ghost task' });
    store = [todo];
    await renderList();

    // Server truth: it is already gone; the DELETE surfaces a 404.
    store = [];
    deleteTodoMock.mockRejectedValueOnce(
      new ApiClientError('not_found', 'Todo not found', 404),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete ghost task' }));

    await waitFor(() => expect(screen.queryByTestId('todo-row')).not.toBeInTheDocument());
    expect(screen.queryByText(ACTION_ERROR_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('TodoRow — error association (Story 3.5, AC6)', () => {
  it('links the checkbox to the row error via aria-describedby when a write fails', async () => {
    const todo = makeTodo({ description: 'file taxes', completed: false });
    store = [todo];
    await renderList();

    toggleTodoMock.mockRejectedValueOnce(new Error('boom'));

    const checkbox = screen.getByRole('checkbox', { name: 'file taxes' });
    // No association while healthy.
    expect(checkbox).not.toHaveAttribute('aria-describedby');

    fireEvent.click(checkbox);

    const alert = await screen.findByRole('alert');
    const describedby = checkbox.getAttribute('aria-describedby');
    expect(describedby).toBeTruthy();
    // The described element is the rendered inline error (role="alert").
    expect(alert).toHaveAttribute('id', describedby!);
    expect(alert).toHaveTextContent(ACTION_ERROR_MESSAGE);
    // The label association (name from the description) is untouched.
    expect(checkbox).toHaveAccessibleName('file taxes');
  });
});

describe('TodoRow — keyboard-safe delete focus management (Story 3.5, AC3)', () => {
  it('moves focus to the next row\'s delete when a focused row is deleted by keyboard', async () => {
    store = [
      makeTodo({ description: 'first' }),
      makeTodo({ description: 'second' }),
    ];
    await renderList();

    const firstDelete = screen.getByRole('button', { name: 'Delete first' });
    const secondDelete = screen.getByRole('button', { name: 'Delete second' });

    // Simulate keyboard use: the delete button holds focus, then is activated.
    firstDelete.focus();
    expect(document.activeElement).toBe(firstDelete);
    fireEvent.click(firstDelete);

    // Row removed optimistically; focus is NOT stranded on <body>.
    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Delete first' }),
      ).not.toBeInTheDocument(),
    );
    expect(document.activeElement).toBe(secondDelete);
  });

  it('falls back to the add-input when the last row is deleted by keyboard', async () => {
    store = [makeTodo({ description: 'only row' })];
    // Render the list alongside a stand-in add-input (App wires the real
    // AddInput above the list); the handler targets `.orbit-add-input`.
    const utils = renderWithClient(
      <>
        <input className="orbit-add-input" aria-label="Add a todo" />
        <TodoList />
      </>,
    );
    await screen.findAllByTestId('todo-row');

    const del = screen.getByRole('button', { name: 'Delete only row' });
    del.focus();
    fireEvent.click(del);

    await waitFor(() =>
      expect(screen.queryByTestId('todo-row')).not.toBeInTheDocument(),
    );
    expect(document.activeElement).toBe(
      utils.container.querySelector('.orbit-add-input'),
    );
  });

  it('does not manage focus for a mouse delete (button not focused first)', async () => {
    store = [
      makeTodo({ description: 'alpha' }),
      makeTodo({ description: 'beta' }),
    ];
    await renderList();

    // No prior .focus() → activeElement is <body>; the mouse path must not
    // throw and must still remove the row.
    fireEvent.click(screen.getByRole('button', { name: 'Delete alpha' }));

    await waitFor(() =>
      expect(
        screen.queryByRole('button', { name: 'Delete alpha' }),
      ).not.toBeInTheDocument(),
    );
    expect(deleteTodoMock).toHaveBeenCalled();
  });
});

describe('TodoRow — interaction boundaries & a11y', () => {
  it('does nothing when the description text is clicked (no toggle, no delete)', async () => {
    const todo = makeTodo({ description: 'read the docs', completed: false });
    store = [todo];
    await renderList();

    fireEvent.click(screen.getByText('read the docs'));

    // No mutation fired and the row state is unchanged.
    expect(toggleTodoMock).not.toHaveBeenCalled();
    expect(deleteTodoMock).not.toHaveBeenCalled();
    expect(screen.getByTestId('todo-row')).toHaveAttribute('data-completed', 'false');
  });

  it('exposes a labeled checkbox (name from the description) whose checked state reflects completion', async () => {
    store = [makeTodo({ description: 'buy milk', completed: true })];
    await renderList();

    const checkbox = screen.getByRole('checkbox', { name: 'buy milk' });
    expect(checkbox).toBeChecked(); // completion conveyed by the checkbox state, not color alone
  });

  it('renders the delete affordance as a real focusable button with an accessible name and a >=44px target hook', async () => {
    store = [makeTodo({ description: 'wash car' })];
    await renderList();

    const del = screen.getByRole('button', { name: 'Delete wash car' });
    expect(del.tagName).toBe('BUTTON');
    expect(del).toHaveClass('orbit-row__delete'); // CSS gives it the >=44px target + hover/touch visibility
    // NOTE: pointer-hover vs touch visibility is enforced purely in CSS media
    // queries (`@media (hover)` / `(hover: none)`), which jsdom does not lay
    // out; asserted structurally here and covered visually by the CSS block.
  });
});
