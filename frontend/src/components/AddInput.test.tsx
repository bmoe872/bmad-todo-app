import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTodo } from '../api/todos';
import { todosQueryKey } from '../hooks/useTodos';
import { OPTIMISTIC_ID_PREFIX } from '../hooks/useCreateTodo';
import type { Todo } from '../types';
import { renderWithClient } from '../test-utils';
import {
  AddInput,
  CREATE_ERROR_MESSAGE,
  EMPTY_MESSAGE,
  MAX_LENGTH,
  PLACEHOLDER,
  TOO_LONG_MESSAGE,
} from './AddInput';

// Mock the API layer — no real network, no Postgres. The mutation hook still
// runs against a real (retry-off) QueryClient via renderWithClient.
vi.mock('../api/todos');
const createTodoMock = vi.mocked(createTodo);

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: crypto.randomUUID(),
    description: 'existing task',
    completed: false,
    created_at: '2026-07-01T09:00:00Z',
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

const input = () => screen.getByPlaceholderText(PLACEHOLDER) as HTMLInputElement;
const form = () => screen.getByTestId('add-input-slot');

beforeEach(() => {
  createTodoMock.mockReset();
  // Default: touch/unknown device so mount autofocus does not run in tests
  // that don't care about it (jsdom has no matchMedia otherwise).
  stubMatchMedia(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('AddInput — rendering', () => {
  it('renders an always-visible single-line field with the exact placeholder', () => {
    renderWithClient(<AddInput />);
    const el = input();
    expect(el).toBeInTheDocument();
    // Single-line: an <input>, never a <textarea>.
    expect(el.tagName).toBe('INPUT');
    expect(el).toHaveAttribute('placeholder', 'What needs doing?');
  });
});

describe('AddInput — client-side validation (no request sent)', () => {
  it('blocks empty submit with "Type something first." and issues no request', async () => {
    renderWithClient(<AddInput />);

    fireEvent.submit(form());

    expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument();
    expect(EMPTY_MESSAGE).toBe('Type something first.');
    expect(createTodoMock).not.toHaveBeenCalled();
  });

  it('blocks whitespace-only submit with the same message and no request', async () => {
    renderWithClient(<AddInput />);

    fireEvent.change(input(), { target: { value: '     ' } });
    fireEvent.submit(form());

    expect(await screen.findByText(EMPTY_MESSAGE)).toBeInTheDocument();
    expect(createTodoMock).not.toHaveBeenCalled();
  });

  it('blocks > 500 chars (trimmed) with the over-length message and no request', async () => {
    renderWithClient(<AddInput />);

    // Whitespace padding must not save an otherwise-too-long value.
    fireEvent.change(input(), {
      target: { value: `  ${'x'.repeat(MAX_LENGTH + 1)}  ` },
    });
    fireEvent.submit(form());

    expect(await screen.findByText(TOO_LONG_MESSAGE)).toBeInTheDocument();
    expect(TOO_LONG_MESSAGE).toBe(
      "That's a bit long — keep it under 500 characters.",
    );
    expect(createTodoMock).not.toHaveBeenCalled();
  });

  it('allows exactly 500 chars (boundary) — issues the request', async () => {
    createTodoMock.mockResolvedValue(makeTodo({ description: 'x'.repeat(MAX_LENGTH) }));
    renderWithClient(<AddInput />);

    fireEvent.change(input(), { target: { value: 'x'.repeat(MAX_LENGTH) } });
    fireEvent.submit(form());

    await waitFor(() =>
      expect(createTodoMock).toHaveBeenCalledWith('x'.repeat(MAX_LENGTH)),
    );
  });
});

describe('AddInput — valid submit + optimistic create', () => {
  it('submits the trimmed value, inserts an optimistic row at the TOP, then clears + refocuses', async () => {
    const existing = makeTodo({ description: 'existing task' });
    createTodoMock.mockResolvedValue(
      makeTodo({ description: 'buy milk', created_at: '2026-07-23T10:00:00Z' }),
    );

    const { client } = renderWithClient(<AddInput />);
    client.setQueryData(todosQueryKey, [existing]);

    input().focus();
    fireEvent.change(input(), { target: { value: '  buy milk  ' } });
    fireEvent.submit(form());

    // Trimmed value is what gets created.
    await waitFor(() => expect(createTodoMock).toHaveBeenCalledWith('buy milk'));

    // Optimistic row appears at the TOP of the cached List with a temp id.
    await waitFor(() => {
      const list = client.getQueryData<Todo[]>(todosQueryKey) ?? [];
      expect(list).toHaveLength(2);
      expect(list[0].description).toBe('buy milk');
      expect(list[0].id.startsWith(OPTIMISTIC_ID_PREFIX)).toBe(true);
      expect(list[1].description).toBe('existing task');
    });

    // On success the field clears and refocuses.
    await waitFor(() => expect(input().value).toBe(''));
    expect(document.activeElement).toBe(input());
  });
});

describe('AddInput — server-error rollback', () => {
  it('rolls back the optimistic row, preserves the typed text, and shows the create error', async () => {
    const existing = makeTodo({ description: 'existing task' });
    createTodoMock.mockRejectedValue(new Error('server said no'));

    const { client } = renderWithClient(<AddInput />);
    client.setQueryData(todosQueryKey, [existing]);

    fireEvent.change(input(), { target: { value: 'flaky task' } });
    fireEvent.submit(form());

    // Non-blocking error surfaces under the input.
    expect(await screen.findByText(CREATE_ERROR_MESSAGE)).toBeInTheDocument();
    expect(CREATE_ERROR_MESSAGE).toBe("Couldn't save that — try again.");

    // Cache rolled back to exactly the pre-submit snapshot.
    await waitFor(() => {
      const list = client.getQueryData<Todo[]>(todosQueryKey) ?? [];
      expect(list).toHaveLength(1);
      expect(list[0].description).toBe('existing task');
    });

    // Typed text is preserved so nothing the user wrote is lost.
    expect(input().value).toBe('flaky task');
  });
});

describe('AddInput — keyboard', () => {
  it('Escape clears the current text without submitting', async () => {
    renderWithClient(<AddInput />);

    fireEvent.change(input(), { target: { value: 'draft thought' } });
    expect(input().value).toBe('draft thought');

    fireEvent.keyDown(input(), { key: 'Escape' });

    expect(input().value).toBe('');
    // Nothing submitted.
    expect(createTodoMock).not.toHaveBeenCalled();
    // No lingering validation/error message either.
    expect(screen.queryByText(EMPTY_MESSAGE)).not.toBeInTheDocument();
  });
});

describe('AddInput — autofocus policy', () => {
  it('autofocuses on a desktop (fine-pointer) device', () => {
    stubMatchMedia(true);
    renderWithClient(<AddInput />);
    expect(document.activeElement).toBe(input());
  });

  it('does NOT force focus on a touch (coarse-pointer) device', () => {
    stubMatchMedia(false);
    renderWithClient(<AddInput />);
    expect(document.activeElement).not.toBe(input());
  });
});
