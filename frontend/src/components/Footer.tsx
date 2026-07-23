// Footer bar (FR-9, UX-DR7, UX-DR13, UX-DR14): LEFT = completed count in a polite
// aria-live region; RIGHT = the ghost "Clear completed" action, inert/absent when
// zero Todos are completed. Reads the List through useTodos (AD-6) — never holds
// its own copy — so the count tracks the same cache the clear flow mutates.
//
// The bulk-delete-failure inline error (AC5) renders here, reusing InlineError.

import { useTodos } from '../hooks/useTodos';
import { InlineError } from './InlineError';

/** Exact footer count microcopy (EXPERIENCE.md Voice & Tone). */
export function completedCountLabel(n: number): string {
  return n === 0 ? 'No completed items' : `${n} completed`;
}

interface FooterProps {
  /** Activate Clear-completed (from useClearCompleted). */
  onClear: () => void;
  /** Bulk-delete error message to surface inline, or null/undefined. */
  error?: string | null;
}

export function Footer({ onClear, error }: FooterProps) {
  const { data } = useTodos();
  const completedCount = data
    ? data.filter((todo) => todo.completed).length
    : 0;

  return (
    <footer className="orbit-footer" aria-label="List summary">
      <div className="orbit-footer__bar">
        <span className="orbit-footer__count" role="status" aria-live="polite">
          {completedCountLabel(completedCount)}
        </span>
        {completedCount > 0 ? (
          <button
            type="button"
            className="orbit-footer__clear"
            onClick={onClear}
          >
            Clear completed
          </button>
        ) : null}
      </div>
      {error ? <InlineError message={error} /> : null}
    </footer>
  );
}
