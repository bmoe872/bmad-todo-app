// Undo toast (UX-DR8, UX-DR14): transient bottom overlay shown after Clear
// completed. surface-raised bar, rounded.md, ink-primary text + an accent-strong
// "Undo" action (a real focusable button). Announced via role="status". Hover or
// focus pauses the ~6s auto-dismiss countdown; leaving resumes it. Near-full-width
// above the thumb zone on mobile (see global.css).
//
// The countdown timer itself lives in useClearCompleted; this component only
// reports hover/focus (pause/resume) and invokes undo().

/** Leading sentence of the toast; the "Undo" button completes it → "Cleared N completed. Undo". */
export function undoToastMessage(count: number): string {
  return `Cleared ${count} completed.`;
}

interface UndoToastProps {
  /** Number of cleared Todos (N in "Cleared N completed. Undo"). */
  count: number;
  /** Restore the cleared Todos (pure client-side, no server call). */
  onUndo: () => void;
  /** Pause the auto-dismiss countdown (hover/focus). */
  onPause: () => void;
  /** Resume the auto-dismiss countdown (unhover/blur). */
  onResume: () => void;
}

export function UndoToast({ count, onUndo, onPause, onResume }: UndoToastProps) {
  return (
    <div className="orbit-toast-layer">
      <div
        className="orbit-toast"
        role="status"
        aria-live="polite"
        data-testid="undo-toast"
        onMouseEnter={onPause}
        onMouseLeave={onResume}
        onFocus={onPause}
        onBlur={onResume}
      >
        <span className="orbit-toast__text">{undoToastMessage(count)}</span>
        <button type="button" className="orbit-toast__action" onClick={onUndo}>
          Undo
        </button>
      </div>
    </div>
  );
}
