// The single floating translucent Orbit panel (UX-DR1, UX-DR2). surface-scrim
// at ~72% opacity, rounded-lg corners, 1px hairline border, one soft ambient
// shadow, centered column capped at 560px over the void.
//
// It composes the IA zones top → bottom (EXPERIENCE.md): Title → add-input slot
// → list → footer slot. The add-input is the live AddInput (Story 3.2); the
// footer is still a clean placeholder slot until Story 3.4.

import { AddInput } from './AddInput';

interface PanelProps {
  /** The List region (TodoList) — the only wired zone in Story 3.1. */
  children: React.ReactNode;
  /** Add-input zone. Defaults to the live AddInput (Story 3.2). */
  addSlot?: React.ReactNode;
  /** Footer zone (Story 3.4). */
  footerSlot?: React.ReactNode;
}

export function Panel({ children, addSlot, footerSlot }: PanelProps) {
  return (
    <section className="orbit-panel" aria-labelledby="orbit-title">
      <h1 className="orbit-title" id="orbit-title">
        Todos
      </h1>

      {addSlot ?? <AddInput />}

      {children}

      <div className="orbit-footer-slot">{footerSlot}</div>
    </section>
  );
}
