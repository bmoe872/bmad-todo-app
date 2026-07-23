// A single Todo row: an accessible checkbox, the description as plain text, and
// a delete affordance. Story 3.3 wires the interactive behavior:
//
//   - The checkbox toggles completion OPTIMISTICALLY and restyles the row IN
//     PLACE (checked box + strikethrough + `ink-completed` ink — three
//     redundant cues), never reordering it (FR-2, FR-5). It announces its new
//     state to assistive tech (a real labeled checkbox).
//   - The delete button removes the row optimistically (permanent, no undo,
//     FR-3); a 404 is treated as already-gone. Hover-revealed on pointer,
//     always visible on touch (handled in CSS).
//   - Clicking the description does NOTHING — only the checkbox and × are hit
//     targets (no in-place edit in v1; avoids accidental toggles).
//   - On a toggle/delete failure the optimistic cache rolls back (row reverts in
//     place) and a brief inline error shows near the row.
//
// The description is rendered as a React child (never dangerouslySetInnerHTML)
// so HTML-like descriptions are XSS-safe (NFR-Sec).

import { isAlreadyGone, useTodoMutations } from '../hooks/useTodoMutations';
import type { Todo } from '../types';
import { InlineError } from './InlineError';

// Action-error microcopy (EXPERIENCE.md Voice & Tone) — shared with tests.
export const ACTION_ERROR_MESSAGE = "Couldn't save that — try again.";

interface TodoRowProps {
  todo: Todo;
}

export function TodoRow({ todo }: TodoRowProps) {
  const { toggle, remove } = useTodoMutations();

  const textId = `todo-text-${todo.id}`;

  // Surface a row-scoped inline error when a write fails. A delete that 404s is
  // "already-gone", not a failure, so it never shows an error.
  const showError =
    toggle.isError || (remove.isError && !isAlreadyGone(remove.error));

  return (
    <li className="orbit-row" data-completed={todo.completed} data-testid="todo-row">
      <div className="orbit-row__main">
        {/* 44px hit target wrapping the ≥24px visual checkbox. The label wraps
            ONLY the checkbox (not the description) so clicking the text never
            toggles. The name comes from the description via aria-labelledby. */}
        <label className="orbit-row__check-hit">
          <input
            type="checkbox"
            className="orbit-row__check"
            checked={todo.completed}
            onChange={(event) => {
              toggle.mutate({ id: todo.id, completed: event.target.checked });
            }}
            aria-labelledby={textId}
            data-testid="todo-checkbox"
          />
        </label>

        {/* Non-interactive: no click handler. Plain text (auto-escaped). */}
        <span id={textId} className="orbit-row__text">
          {todo.description}
        </span>

        {/* Empty button — the "×" glyph is drawn via CSS so it stays out of the
            row's text content; the accessible name is the aria-label. */}
        <button
          type="button"
          className="orbit-row__delete"
          onClick={() => {
            remove.mutate({ id: todo.id });
          }}
          aria-label={`Delete ${todo.description}`}
          data-testid="todo-delete"
        />
      </div>

      {showError ? (
        <InlineError message={ACTION_ERROR_MESSAGE} />
      ) : null}
    </li>
  );
}
