import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Todo } from '../types';
import { ApiClientError } from './client';
// Real functions (NOT mocked here) — this file verifies the actual request the
// api layer builds and how it parses/propagates the response.
import { deleteTodo, toggleTodo } from './todos';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sampleTodo: Todo = {
  id: '11111111-1111-4111-8111-111111111111',
  description: 'call the dentist',
  completed: false,
  created_at: '2026-07-23T15:04:05Z',
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('toggleTodo', () => {
  it('PATCHes /api/todos/{id} with the new completed state and returns the updated Todo', async () => {
    const updated = { ...sampleTodo, completed: true };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(updated));
    vi.stubGlobal('fetch', fetchMock);

    const result = await toggleTodo(sampleTodo.id, true);

    expect(result).toEqual(updated);
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/todos/${sampleTodo.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ completed: true }),
        // The client sets Content-Type; the mutation must not clobber it.
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });

  it('propagates the AD-5 error envelope as an ApiClientError (e.g. 404)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 'not_found', message: 'Todo not found' } }, 404),
      ),
    );

    await expect(toggleTodo(sampleTodo.id, true)).rejects.toMatchObject({
      name: 'ApiClientError',
      code: 'not_found',
      status: 404,
    });
  });
});

describe('deleteTodo', () => {
  it('DELETEs /api/todos/{id} and resolves undefined on 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(deleteTodo(sampleTodo.id)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/todos/${sampleTodo.id}`,
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('surfaces a 404 as an ApiClientError (status 404) for the caller to treat as already-gone', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse({ error: { code: 'not_found', message: 'gone' } }, 404),
      ),
    );

    const error = await deleteTodo(sampleTodo.id).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiClientError);
    expect((error as ApiClientError).status).toBe(404);
  });
});
