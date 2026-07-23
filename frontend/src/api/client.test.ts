import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Todo } from '../types';
import { ApiClientError, apiFetch } from './client';
import { getTodos } from './todos';

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

describe('api client', () => {
  it('parses a successful GET /api/todos into an unwrapped Todo[] (newest-first order preserved)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ todos: [sampleTodo] }));
    vi.stubGlobal('fetch', fetchMock);

    const todos = await getTodos();

    expect(todos).toEqual([sampleTodo]);
    // created_at keeps the trailing "Z" exactly as the wire delivers it.
    expect(todos[0].created_at).toBe('2026-07-23T15:04:05Z');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/todos',
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
    );
  });

  it('parses the AD-5 error envelope on a non-2xx response into a typed ApiClientError', async () => {
    const envelope = {
      error: {
        code: 'internal_error',
        message: 'Something went wrong',
        details: [{ field: 'x', issue: 'bad' }],
      },
    };
    // Fresh Response per call — a Response body can only be consumed once.
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(envelope, 500))),
    );

    await expect(getTodos()).rejects.toBeInstanceOf(ApiClientError);
    await expect(getTodos()).rejects.toMatchObject({
      code: 'internal_error',
      message: 'Something went wrong',
      status: 500,
      details: [{ field: 'x', issue: 'bad' }],
    });
  });

  it('throws a synthetic ApiClientError when a non-2xx body is not the envelope shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('Bad Gateway', { status: 502 })),
    );

    await expect(getTodos()).rejects.toMatchObject({
      name: 'ApiClientError',
      status: 502,
    });
  });

  it('throws a network_error ApiClientError when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(getTodos()).rejects.toMatchObject({
      code: 'network_error',
      status: 0,
    });
  });

  it('returns undefined for a 204 No Content response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(apiFetch('/todos/x', { method: 'DELETE' })).resolves.toBeUndefined();
  });
});
