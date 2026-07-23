// Todo resource calls (AD-4). Story 3.1 added the List read; Story 3.2 adds the
// create. Toggle / delete / clear-completed arrive with their stories (3.3–3.4)
// and are intentionally not stubbed here to avoid dead code.

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
