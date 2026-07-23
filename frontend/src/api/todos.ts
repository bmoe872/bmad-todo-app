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
