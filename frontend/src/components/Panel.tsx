// The single floating translucent Orbit panel (UX-DR1, UX-DR2). surface-scrim
// at ~72% opacity, rounded-lg corners, 1px hairline border, one soft ambient
// shadow, centered column capped at 560px over the void.
//
// It composes the IA zones top → bottom (EXPERIENCE.md): Title → add-input slot
// → list → footer slot. The add-input and footer are rendered as clean
// placeholder slots here; their real behavior arrives in Stories 3.2 and 3.4.

interface PanelProps {
  /** The List region (TodoList) — the only wired zone in Story 3.1. */
  children: React.ReactNode;
  /** Add-input zone (Story 3.2). Defaults to a non-interactive placeholder. */
  addSlot?: React.ReactNode;
  /** Footer zone (Story 3.4). */
  footerSlot?: React.ReactNode;
  /** Bottom overlay zone for the transient Undo toast (Story 3.4). */
  toastSlot?: React.ReactNode;
}

// Add-input placeholder copy comes from the DESIGN.md add-input spec; the real
// interactive field (and this exact placeholder attribute) lands in Story 3.2.
const ADD_INPUT_PLACEHOLDER = 'What needs doing?';

export function Panel({ children, addSlot, footerSlot, toastSlot }: PanelProps) {
  return (
    <>
      <section className="orbit-panel" aria-labelledby="orbit-title">
        <h1 className="orbit-title" id="orbit-title">
          Todos
        </h1>

        {addSlot ?? (
          <div className="orbit-add-slot" aria-hidden="true" data-testid="add-input-slot">
            {ADD_INPUT_PLACEHOLDER}
          </div>
        )}

        {children}

        <div className="orbit-footer-slot">{footerSlot}</div>
      </section>
      {/* Transient Undo-toast overlay (Story 3.4): position:fixed, so it lives
          outside the panel box but is composed here alongside the footer slot. */}
      {toastSlot}
    </>
  );
}
