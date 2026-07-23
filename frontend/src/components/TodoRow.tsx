// A single Todo row — MINIMAL / read-only for Story 3.1.
//
// Renders: a checkbox affordance (visual only; the working toggle is Story 3.3),
// the description as plain text (React auto-escaping — never
// dangerouslySetInnerHTML, so HTML-like descriptions are XSS-safe, NFR-Sec),
// and a delete affordance placeholder (visual only; wired in Story 3.3).
//
// Props are shaped so Story 3.3 adds onToggle/onDelete handlers without
// restructuring. Completed styling (checked + strikethrough + ink-completed)
// also lands with the toggle in 3.3; the markup hook (`data-completed`) is here.

import type { Todo } from '../types';

interface TodoRowProps {
  todo: Todo;
}

export function TodoRow({ todo }: TodoRowProps) {
  return (
    <li className="orbit-row" data-completed={todo.completed} data-testid="todo-row">
      {/* Visual checkbox placeholder — interactive checkbox is Story 3.3. */}
      <span className="orbit-row__check" aria-hidden="true" />
      <span className="orbit-row__text">{todo.description}</span>
      {/* Delete affordance placeholder — wired in Story 3.3. */}
      <span className="orbit-row__delete" aria-hidden="true" />
    </li>
  );
}
