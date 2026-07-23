// Shared wire types mirroring the backend JSON contract exactly: snake_case
// keys, no field-name mapping layer (AD-3, Consistency Conventions). These are
// the single source of the client-side Todo shape.

/**
 * A Todo as returned by the API (AD-3). `created_at` is ISO-8601 UTC with a
 * trailing `Z` (e.g. "2026-07-23T15:04:05Z"), emitted by the backend
 * `TodoRead` serializer. `id` is a UUID v4 string.
 */
export interface Todo {
  id: string;
  description: string;
  completed: boolean;
  created_at: string;
}

/** Response envelope for `GET /api/todos` (Success shape: List → { todos: [...] }). */
export interface TodoListResponse {
  todos: Todo[];
}

/** One field-level detail entry in the AD-5 error envelope. */
export interface ApiErrorDetail {
  field: string;
  issue: string;
}

/**
 * The uniform AD-5 error envelope returned for every non-2xx response:
 * `{ "error": { "code", "message", "details"? } }`. Parsed in exactly one place
 * (api/client.ts) so the whole app handles one error shape.
 */
export interface ApiErrorEnvelope {
  error: {
    code: string;
    message: string;
    details?: ApiErrorDetail[];
  };
}
