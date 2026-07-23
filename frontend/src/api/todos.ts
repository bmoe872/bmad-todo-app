// Todo resource calls (AD-4). Story 3.1 added the List read; Story 3.3 adds the
// toggle + delete mutations. Create / clear-completed arrive with 3.2 / 3.4.

import type { Todo, TodoListResponse } from '../types';
import { apiFetch } from './client';

/**
 * Fetch the List: `GET /api/todos` → `{ todos: [...] }`, unwrapped to `Todo[]`.
 * The server orders newest-first (`created_at` DESC, id tiebreak); the client
 * renders that order as-is and never re-sorts (AD-3).
 */
export async function getTodos(): Promise<Todo[]> {
  const data = await apiFetch<TodoListResponse>('/todos');
  return data.todos;
}

/**
 * Toggle completion: `PATCH /api/todos/{id}` with `{ completed }` → `200 Todo`
 * (a bare Todo, not an envelope). Only `completed` is mutable (AD-3); the server
 * flips it in either direction and never reorders. `completed` is the NEW target
 * state. Does NOT pass a `headers` key — the client sets `Content-Type` and a
 * caller-supplied `headers` would clobber it, breaking the JSON body.
 */
export async function toggleTodo(id: string, completed: boolean): Promise<Todo> {
  return apiFetch<Todo>(`/todos/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ completed }),
  });
}

/**
 * Permanently delete a Todo: `DELETE /api/todos/{id}` → `204` (no undo, FR-3).
 * A `404` (already-gone) is NOT swallowed here — it surfaces as an
 * `ApiClientError(status: 404)` so the mutation hook can treat it as
 * already-gone and reconcile rather than roll back (AD-6).
 */
export async function deleteTodo(id: string): Promise<void> {
  await apiFetch<void>(`/todos/${id}`, { method: 'DELETE' });
}
