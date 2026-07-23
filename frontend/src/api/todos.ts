// Todo resource calls (AD-4). Story 3.1 needs only the List read; create /
// toggle / delete / clear-completed arrive with their stories (3.2–3.4) and are
// intentionally not stubbed here to avoid dead code.

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
