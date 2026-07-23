// Cold-load placeholder: 3–5 shimmer rows in `surface-raised` matching row
// height (FR-6, UX-DR10). Loading carries NO text — the skeleton is the signal.
// Never a spinner; the query always resolves to loaded / empty / error.
// Shimmer animation is disabled for prefers-reduced-motion (see global.css).

const SKELETON_ROW_COUNT = 4;

export function SkeletonRows() {
  return (
    <div
      className="orbit-skeleton"
      role="status"
      aria-label="Loading your list"
      aria-busy="true"
      data-testid="skeleton-rows"
    >
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div key={i} className="orbit-skeleton__row" aria-hidden="true" />
      ))}
    </div>
  );
}
