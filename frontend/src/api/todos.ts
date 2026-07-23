// Todo resource calls (AD-4). Story 3.1 added the List read; 3.2 adds create;
// 3.3 adds toggle + delete; 3.4 adds clear-completed.

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
 * Create a Todo: `POST /api/todos` with `{ description }` → `201 Todo` (the
 * bare created Todo, not an envelope — per the API contract). The server trims
 * and validates the description (required, non-empty, single-line, ≤ 500 chars)
 * and sets `id`, `completed=false`, and `created_at`; a `422` surfaces as an
 * `ApiClientError` via `apiFetch`. The optimistic-create mutation
 * (`useCreateTodo`) owns cache insertion / rollback / reconcile (AD-6).
 */
export async function createTodo(description: string): Promise<Todo> {
  return apiFetch<Todo>('/todos', {
    method: 'POST',
    body: JSON.stringify({ description }),
  });
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

/** Response for the bulk clear-completed endpoint: `{ deleted: <int> }`. */
interface ClearCompletedResponse {
  deleted: number;
}

/**
 * Clear-completed bulk delete (FR-9, AD-7): `DELETE /api/todos/completed` with a
 * body carrying the exact id snapshot `{ ids: [...] }` captured at click time.
 * The server deletes only those ids that are still completed and returns
 * `200 { deleted }` (not 204). The client always sends the snapshot so a Todo
 * completed *after* the click is never in it and never cleared.
 */
export async function clearCompleted(
  ids: string[],
): Promise<ClearCompletedResponse> {
  return apiFetch<ClearCompletedResponse>('/todos/completed', {
    method: 'DELETE',
    body: JSON.stringify({ ids }),
  });
}
