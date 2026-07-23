// Non-blocking inline error (UX-DR9, UX-DR13). `danger` text in `meta` size,
// never a modal or full-screen state. Optionally renders a real focusable Retry
// button. Reused by the load-error path here and by the action-error paths in
// Stories 3.2–3.4.

interface InlineErrorProps {
  message: string;
  /** Label for the retry affordance; when omitted, no retry button is shown. */
  retryLabel?: string;
  onRetry?: () => void;
}

export function InlineError({ message, retryLabel, onRetry }: InlineErrorProps) {
  return (
    <div className="orbit-inline-error" role="alert" data-testid="inline-error">
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
