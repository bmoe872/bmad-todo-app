// Empty List state (FR-6, UX-DR11). Calm, not a blank void. Exact microcopy
// from the EXPERIENCE.md Voice & Tone table — do not reword.

export const EMPTY_MESSAGE = 'Nothing to do — add something above.';

export function EmptyState() {
  return (
    <p className="orbit-empty" data-testid="empty-state">
      {EMPTY_MESSAGE}
    </p>
  );
}
