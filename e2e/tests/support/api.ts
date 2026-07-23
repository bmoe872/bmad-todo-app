// Real-backend API helpers used by the E2E specs. These hit the SAME single
// origin as the browser (`${E2E_BASE_URL}/api`) so they exercise the actual
// nginx reverse-proxy → FastAPI → Postgres path (AD-10) — nothing is mocked.
//
// They serve two purposes:
//   1. Deterministic state management (seed/reset) so each spec is independent
//      against the shared single global List.
//   2. The CONTRACT check (epics.md §727): every response shape and status code
//      observed here is asserted against the fixed `/api` contract (AD-4).

import { APIRequestContext, expect } from '@playwright/test';

/** The `Todo` wire shape (AD-3). */
export interface Todo {
  id: string;
  description: string;
  completed: boolean;
  created_at: string;
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Assert a value matches the AD-3 `Todo` contract shape. */
export function assertTodoShape(todo: Todo): void {
  expect(typeof todo.id).toBe('string');
  expect(typeof todo.description).toBe('string');
  expect(typeof todo.completed).toBe('boolean');
  expect(todo.created_at).toMatch(ISO_UTC);
}

/** `GET /api/todos` → `200 { todos: [...] }` ordered newest-first (AD-4). */
export async function listTodos(request: APIRequestContext): Promise<Todo[]> {
  const res = await request.get('/api/todos');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body.todos)).toBe(true);
  for (const todo of body.todos) assertTodoShape(todo);
  return body.todos;
}

/** `POST /api/todos` → `201 Todo` (bare Todo, completed=false) (AD-4). */
export async function createTodo(
  request: APIRequestContext,
  description: string,
): Promise<Todo> {
  const res = await request.post('/api/todos', { data: { description } });
  expect(res.status()).toBe(201);
  const todo = await res.json();
  assertTodoShape(todo);
  expect(todo.completed).toBe(false);
  expect(todo.description).toBe(description);
  return todo;
}

/** `PATCH /api/todos/{id}` → `200 Todo` (AD-4). */
export async function setCompleted(
  request: APIRequestContext,
  id: string,
  completed: boolean,
): Promise<Todo> {
  const res = await request.patch(`/api/todos/${id}`, { data: { completed } });
  expect(res.status()).toBe(200);
  const todo = await res.json();
  assertTodoShape(todo);
  expect(todo.completed).toBe(completed);
  return todo;
}

/** `DELETE /api/todos/{id}` → `204` (or `404` already-gone) (AD-4). */
export async function deleteTodo(
  request: APIRequestContext,
  id: string,
): Promise<void> {
  const res = await request.delete(`/api/todos/${id}`);
  expect([204, 404]).toContain(res.status());
}

/**
 * Return the shared global List to EMPTY by deleting every Todo (regardless of
 * completion) through the real API. Called before each spec so tests never race
 * on residual state. Verifies the list is empty afterward.
 */
export async function resetState(request: APIRequestContext): Promise<void> {
  const todos = await listTodos(request);
  for (const todo of todos) {
    await deleteTodo(request, todo.id);
  }
  const remaining = await listTodos(request);
  expect(remaining).toHaveLength(0);
}

/** Seed N Todos (oldest first) and return them in creation order. */
export async function seedTodos(
  request: APIRequestContext,
  descriptions: string[],
): Promise<Todo[]> {
  const created: Todo[] = [];
  for (const description of descriptions) {
    // Sequential so `created_at` ordering is deterministic (newest-first list).
    created.push(await createTodo(request, description));
  }
  return created;
}
