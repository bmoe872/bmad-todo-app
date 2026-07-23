# Accessibility Pass — nearform_todo_app

Story 6.3 · date 2026-07-23 · baseline commit `99c1e01`

Documents the WCAG 2.1 AA posture beyond the automated E2E gate from Story 6.1.
Covers the axe baseline, keyboard operability + focus management, `aria-live`
announcements, 44px targets, the scrim/contrast contract over the backdrop,
reduced-motion, and 200% zoom. Items are labelled **MEASURED/AUTOMATED** (proven
by the 6.1 gate or inspection) or **DESIGN-ANALYSIS** (argued from the CSS/DOM).

## Summary

| Area | Result | Basis |
|------|--------|-------|
| Zero critical WCAG 2.1 AA (backdrop active) | PASS | Story 6.1 axe gate (automated) |
| Text contrast over the backdrop (scrim contract) | PASS | axe color-contrast rule + scrim design |
| Keyboard operability of the full loop | PASS | 6.1 keyboard-only spec + code |
| Focus visibility | PASS | `:focus-visible` 2px ring, all interactive elements |
| Focus management on delete | PASS | `TodoRow` focus-transfer + 6.1 spec |
| `aria-live` announcements | PASS | status/alert regions per component |
| 44px touch targets | PASS | CSS min 44×44 on all controls |
| Reduced-motion fallback | PASS | 6.1 reduced-motion spec + media query |
| 200% zoom / reflow | PASS | DESIGN-ANALYSIS (relative units, no fixed heights on content) |

No critical or blocking accessibility issues. Residual items are minor and noted
at the end.

---

## 1. Automated baseline (Story 6.1) — AUTOMATED, PASS

`e2e/tests/a11y.spec.ts` runs `@axe-core/playwright` with the WCAG tag set
(`wcag2a, wcag2aa, wcag21a, wcag21aa`) on the **loaded** and **loaded-empty**
states **with the backdrop active** (the real three.js layer mounted, not
disabled), and asserts **zero violations of `impact === 'critical'`** — including
`color-contrast` of Todo text over the backdrop. This closes the
axe-with-backdrop-active item deferred from Epics 3/4. This pass builds on that
result rather than re-running it; the sections below add the manual/inspection
dimensions the automated gate does not fully cover.

## 2. Contrast / scrim contract — PASS

- The floating Panel sits on `--color-surface-scrim` (`#0e1324`) at ~72% opacity
  (`frontend/src/styles/global.css`), the load-bearing device that guarantees
  Todo text is read against a solid dark scrim rather than transparent-over-void
  — so the animated backdrop behind it cannot erode text contrast.
- Ink tokens on the scrim: primary `#eef1fa`, secondary `#a7afc8`, completed
  `#727c99` — the completed-row de-emphasis (strikethrough + dimmer ink) is
  documented to hold ≥ 4.5:1 on the scrim (see the `global.css` completed-row
  comment). axe's `color-contrast` rule is part of the 6.1 AA gate and passes.

## 3. Keyboard operability + focus — PASS

- **Tab order (Story 3.5):** add-input → row checkbox → row delete → footer
  `Clear completed` → toast `Undo`. Every action is reachable and operable by
  keyboard; the 6.1 keyboard-only spec drives a full create→toggle→delete by key
  (Enter/Space) and asserts focus never lands on the `aria-hidden` backdrop.
- **Focus visibility:** `:where(button, a, input, [tabindex]):focus-visible`
  applies a 2px `--color-border-focus` (`#9cc0ff`) outline; the add-input and
  checkbox have their own explicit focus rings. Visible on all interactive
  elements.
- **Focus management on delete (`TodoRow.tsx`):** when a row is deleted while its
  delete button holds focus (keyboard case), focus is moved to a surviving target
  (next row's delete → previous row's → the add-input) **before** the optimistic
  removal, so focus is never dropped to `<body>`. The mouse path is untouched.
- **Escape** clears the add-input without submitting; **Enter** submits.

## 4. `aria-live` announcements — PASS

| Region | Role / live | Purpose |
|--------|-------------|---------|
| Footer completed-count (`Footer.tsx`) | `role="status" aria-live="polite"` | non-intrusive count updates |
| Undo toast (`UndoToast.tsx`) | `role="status" aria-live="polite"` | announces "Cleared N completed" + Undo |
| Inline error (`InlineError.tsx`) | `role="alert"` | assertive announcement of save/load failures |
| Loading skeleton (`SkeletonRows.tsx`) | `role="status"` | announces the loading state |

Row errors are linked to the checkbox via `aria-describedby` only while showing,
so a screen reader hears the error when focus is on the control (Story 3.5 AC6).
The add-input sets `aria-invalid` + `aria-describedby` while a validation message
is present.

## 5. Touch-target size (44px) — PASS

- Checkbox: a ≥ 44×44 hit target (`.orbit-row__check-hit`, `min-width/height:
  44px`) wraps the ≥ 24×24 visual box — the label wraps only the checkbox so
  clicking the description text never toggles.
- Delete affordance: `min-width/height: 44px`.
- Add-input row: `min-height: 52px`. All meet or exceed the 44px AA target.

## 6. Reduced-motion — PASS

- `@media (prefers-reduced-motion: reduce)` disables the skeleton pulse; the
  backdrop renders a single static frame with no rAF loop (`Backdrop.tsx`), and
  honours a runtime OS toggle (flips to static after mount).
- The Story 6.1 reduced-motion E2E confirms the full loop stays functional and
  the backdrop is static (FR-8).

## 7. 200% zoom / reflow — DESIGN-ANALYSIS, PASS

Layout uses relative units and flexbox with `min-height: 100vh` on the shell and
`min-width: 0` on flex children (allows text to shrink/wrap rather than overflow).
Content controls use `min-height` (not fixed `height`) so text can grow with zoom
without clipping; the panel is width-constrained and centred, so at 200% zoom the
single-column list reflows without a horizontal scrollbar or lost content. No
fixed pixel heights gate the readable content. **Validation method** (for a
browser-driven confirmation): load the app at 1280×720, set browser zoom to 200%
(≈ 640 CSS px effective width), and confirm no horizontal scroll on the body,
all controls remain reachable, and no text is clipped.

---

## Residual items (minor, non-blocking)

- **200% zoom** is argued from the CSS here (design-analysis); a quick
  browser-driven pass at 200% would upgrade it to fully measured — recommended
  but not required for the AA bar (no fixed-height content risk found).
- **Screen-reader manual sweep** (VoiceOver/NVDA) beyond the axe rule set is a
  worthwhile future confirmation of announcement phrasing/order; the automated
  gate + the semantic roles above cover the AA-critical bar.
