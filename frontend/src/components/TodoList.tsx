// The List view + its three required states (FR-6, FR-7). Reads the List
// exclusively through `useTodos` (AD-6) and switches on query state:
//
//   pending  → SkeletonRows        (cold load; never a hanging spinner)
//   error    → InlineError + Retry (frame/input still render; app never crashes)
//   empty    → EmptyState          ("Nothing to do — add something above.")
//   loaded   → <ul> of TodoRow      (server order, newest-first; not re-sorted)
//
// The list header + this region always render, so the panel frame and input
// stay present in every state (UX-DR13).

import { useTodos } from '../hooks/useTodos';
import { EmptyState } from './EmptyState';
import { InlineError } from './InlineError';
import { SkeletonRows } from './SkeletonRows';
import { TodoRow } from './TodoRow';

// Load-error microcopy (EXPERIENCE.md Voice & Tone). Rendered as
// "Couldn't load your list." + a "Retry" affordance → reads "Couldn't load your list. Retry".
export const LOAD_ERROR_MESSAGE = "Couldn't load your list.";
export const RETRY_LABEL = 'Retry';

export function TodoList() {
  const { data, isPending, isError, refetch } = useTodos();

  let content: React.ReactNode;

  if (isPending) {
    content = <SkeletonRows />;
  } else if (isError) {
    content = (
      <InlineError
        message={LOAD_ERROR_MESSAGE}
        retryLabel={RETRY_LABEL}
        onRetry={() => {
          void refetch();
        }}
      />
    );
  } else if (data.length === 0) {
    content = <EmptyState />;
  } else {
    content = (
      <ul className="orbit-list" aria-label="Todos">
        {data.map((todo) => (
          <TodoRow key={todo.id} todo={todo} />
        ))}
      </ul>
    );
  }

  return (
    <section className="orbit-list-region" aria-label="Your list">
      {content}
    </section>
  );
}
