// TanStack Query hook that OWNS the List server-state (AD-6). Components read
// the List through this hook and never hold their own copy of it.
//
// Story 3.1 is read-only. The optimistic create/toggle/delete mutations
// (onMutate snapshot → onError rollback → onSettled invalidate) are added here
// in Stories 3.2–3.3, keyed off this same `todosQueryKey`.

import { useQuery } from '@tanstack/react-query';

import { getTodos } from '../api/todos';
import type { Todo } from '../types';

/** Shared query key for the List — mutations in later stories reuse this. */
export const todosQueryKey = ['todos'] as const;

/**
 * Subscribe to the List query. Exposes the query state the UI switches on:
 * `isPending` (cold load → skeletons), `isError` (→ inline error + retry),
 * `data` (→ empty state or rows), and `refetch` (wired to the Retry action).
 */
export function useTodos() {
  return useQuery<Todo[]>({
    queryKey: todosQueryKey,
    queryFn: getTodos,
  });
}
