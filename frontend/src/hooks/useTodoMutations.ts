// Optimistic toggle + delete mutations for a Todo row (AD-6). Each mutation
// follows the mandatory lifecycle:
//
//   onMutate  → cancel in-flight List refetches, snapshot the cache, apply the
//               optimistic change (≤ ~100ms perceived), return the snapshot.
//   onError   → roll back to the snapshot and let the row surface a non-blocking
//               inline error (never a modal). EXCEPTION: a DELETE that 404s is
//               "already-gone" — do NOT roll back (the row is correctly gone).
//   onSettled → invalidate the List query to reconcile to server truth.
//
// This file deliberately does NOT edit `useTodos.ts`; it imports that hook's
// exported query key read-only so both share one cache entry.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteTodo, toggleTodo } from '../api/todos';
import { ApiClientError } from '../api/client';
import type { Todo } from '../types';
import { todosQueryKey } from './useTodos';

/** Context carried from onMutate to onError so a failed write can roll back. */
interface MutationContext {
  previous: Todo[] | undefined;
}

/** True when an error is the "already-gone" 404 a delete may legitimately hit. */
export function isAlreadyGone(error: unknown): boolean {
  return error instanceof ApiClientError && error.status === 404;
}

/**
 * Toggle + delete mutations for the List. Intended to be consumed per-row so
 * each `TodoRow` owns its own mutation state (`isError`/`error`) for the
 * row-scoped inline error, while all rows share the single List cache entry.
 */
export function useTodoMutations() {
  const queryClient = useQueryClient();

  const applyOptimistic = async (
    mutate: (list: Todo[]) => Todo[],
  ): Promise<MutationContext> => {
    // Stop any in-flight List refetch from overwriting the optimistic write.
    await queryClient.cancelQueries({ queryKey: todosQueryKey });
    const previous = queryClient.getQueryData<Todo[]>(todosQueryKey);
    if (previous) {
      queryClient.setQueryData<Todo[]>(todosQueryKey, mutate(previous));
    }
    return { previous };
  };

  const reconcile = () => {
    void queryClient.invalidateQueries({ queryKey: todosQueryKey });
  };

  const toggle = useMutation<Todo, unknown, { id: string; completed: boolean }, MutationContext>({
    mutationFn: ({ id, completed }) => toggleTodo(id, completed),
    // Flip `completed` on the matching id IN PLACE — order is preserved so a
    // completed Todo never reorders or moves (FR-5).
    onMutate: ({ id, completed }) =>
      applyOptimistic((list) =>
        list.map((todo) => (todo.id === id ? { ...todo, completed } : todo)),
      ),
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData<Todo[]>(todosQueryKey, context.previous);
      }
    },
    onSettled: reconcile,
  });

  const remove = useMutation<void, unknown, { id: string }, MutationContext>({
    mutationFn: ({ id }) => deleteTodo(id),
    // Drop the matching id; the remaining rows keep their positions.
    onMutate: ({ id }) =>
      applyOptimistic((list) => list.filter((todo) => todo.id !== id)),
    onError: (err, _vars, context) => {
      // Already-gone (404): the row is correctly removed — do NOT restore it.
      if (isAlreadyGone(err)) return;
      if (context?.previous) {
        queryClient.setQueryData<Todo[]>(todosQueryKey, context.previous);
      }
    },
    onSettled: reconcile,
  });

  return { toggle, remove };
}
