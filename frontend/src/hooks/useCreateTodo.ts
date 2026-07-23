// Optimistic create mutation (AD-6). Lives in its own file so `useTodos.ts`
// stays the read-only List query owner; this hook only READS the exported
// `todosQueryKey` to write/roll back/reconcile the same cache entry.
//
// AD-6 contract:
//   onMutate   → cancel in-flight List refetches, snapshot the cache, and
//                insert the optimistic Todo at the TOP (newest-first, matching
//                where the server will place a just-created Todo, AD-3).
//   onError    → roll the cache back to the snapshot (non-blocking; the inline
//                error + preserving the user's typed text is AddInput's job).
//   onSettled  → invalidate the List so it reconciles to server truth, which
//                replaces the temporary local id with the server-generated one.

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { createTodo } from '../api/todos';
import type { Todo } from '../types';
import { todosQueryKey } from './useTodos';

/** Prefix marking a not-yet-reconciled optimistic row's temporary local id. */
export const OPTIMISTIC_ID_PREFIX = 'optimistic-';

interface CreateContext {
  /** The List snapshot captured before the optimistic write, for rollback. */
  previous: Todo[] | undefined;
}

/**
 * Mutation that creates a Todo optimistically. `mutate(description)` expects an
 * already-trimmed, client-validated description (AddInput guards empty/>500
 * before calling). The optimistic row appears instantly at the top of the List.
 */
export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, string, CreateContext>({
    mutationFn: (description: string) => createTodo(description),

    onMutate: async (description: string) => {
      // Stop any in-flight List refetch from overwriting our optimistic write.
      await queryClient.cancelQueries({ queryKey: todosQueryKey });

      const previous = queryClient.getQueryData<Todo[]>(todosQueryKey);

      const optimistic: Todo = {
        id: `${OPTIMISTIC_ID_PREFIX}${crypto.randomUUID()}`,
        description,
        completed: false,
        created_at: new Date().toISOString(),
      };

      // Prepend: newest-first, so the new row lands at the top of the List.
      queryClient.setQueryData<Todo[]>(todosQueryKey, [
        optimistic,
        ...(previous ?? []),
      ]);

      return { previous };
    },

    onError: (_error, _description, context) => {
      // Roll back to exactly what was there before the optimistic insert.
      if (context) {
        queryClient.setQueryData<Todo[]>(todosQueryKey, context.previous);
      }
    },

    onSettled: () => {
      // Reconcile to server truth (temp id → server id) on success or failure.
      void queryClient.invalidateQueries({ queryKey: todosQueryKey });
    },
  });
}
