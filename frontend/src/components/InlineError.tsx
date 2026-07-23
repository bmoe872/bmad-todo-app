// Non-blocking inline error (UX-DR9, UX-DR13). `danger` text in `meta` size,
// never a modal or full-screen state. Optionally renders a real focusable Retry
// button. Reused by the load-error path here and by the action-error paths in
// Stories 3.2–3.4.

interface InlineErrorProps {
  message: string;
  /**
   * Optional stable id for the error container. Lets an associated control
   * point at this message via `aria-describedby` (Story 3.5, AC6) so screen
   * readers read the error when focus is on the control — in addition to the
   * `role="alert"` live announcement. Omit for standalone (e.g. load-error) use.
   */
  id?: string;
  /** Label for the retry affordance; when omitted, no retry button is shown. */
  retryLabel?: string;
  onRetry?: () => void;
}

export function InlineError({ id, message, retryLabel, onRetry }: InlineErrorProps) {
  return (
    <div id={id} className="orbit-inline-error" role="alert" data-testid="inline-error">
      <span>{message}</span>
      {retryLabel && onRetry ? (
        <button
          type="button"
          className="orbit-inline-error__retry"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      ) : null}
    </div>
  );
}
