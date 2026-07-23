---
name: Orbit
description: A calm, single-screen personal Todo app. Your list floats in deep space; cube-shaped stars drift past. Restraint over chrome — delight comes from the void, not the UI.
status: final
sources:
  - {planning_artifacts}/prds/prd-nearform_todo_app-2026-07-23/prd.md
  - {planning_artifacts}/prds/prd-nearform_todo_app-2026-07-23/addendum.md
  - {planning_artifacts}/briefs/brief-nearform_todo_app-2026-07-23/brief.md
updated: 2026-07-23
colors:
  surface-void: '#070A14'
  surface-void-far: '#0B1020'
  surface-scrim: '#0E1324'
  surface-raised: '#161C31'
  surface-raised-hover: '#1E2540'
  ink-primary: '#EEF1FA'
  ink-secondary: '#A7AFC8'
  ink-completed: '#727C99'
  ink-disabled: '#525A74'
  accent: '#7AA8FF'
  accent-strong: '#9CC0FF'
  accent-ink: '#07122B'
  border-hairline: '#242B45'
  border-focus: '#9CC0FF'
  danger: '#FF8A8A'
  danger-ink: '#2A0E0E'
  star-cube: '#8FB2FF'
  star-cube-dim: '#39456E'
typography:
  title:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: '-0.01em'
  input:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: 17px
    fontWeight: '400'
    lineHeight: '1.4'
  body:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.45'
  meta:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.4'
  button:
    fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1'
    letterSpacing: '0.01em'
rounded:
  sm: 8px
  md: 14px
  lg: 20px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
  panel-max-width: 560px
components:
  panel:
    background: '{colors.surface-scrim}'
    background-opacity: '0.72'
    radius: '{rounded.lg}'
    border: '{colors.border-hairline}'
    max-width: '{spacing.panel-max-width}'
  add-input:
    background: '{colors.surface-raised}'
    text: '{colors.ink-primary}'
    placeholder: '{colors.ink-secondary}'
    radius: '{rounded.md}'
    focus-ring: '{colors.border-focus}'
    typography: '{typography.input}'
  todo-row:
    text: '{colors.ink-primary}'
    text-completed: '{colors.ink-completed}'
    hover-bg: '{colors.surface-raised-hover}'
    radius: '{rounded.sm}'
    divider: '{colors.border-hairline}'
    typography: '{typography.body}'
  checkbox:
    idle-border: '{colors.ink-secondary}'
    checked-bg: '{colors.accent}'
    checked-mark: '{colors.accent-ink}'
    radius: '{rounded.sm}'
    focus-ring: '{colors.border-focus}'
  button-clear:
    text: '{colors.ink-secondary}'
    text-hover: '{colors.ink-primary}'
    radius: '{rounded.sm}'
    typography: '{typography.button}'
  toast-undo:
    background: '{colors.surface-raised}'
    text: '{colors.ink-primary}'
    action: '{colors.accent-strong}'
    radius: '{rounded.md}'
  inline-error:
    text: '{colors.danger}'
    typography: '{typography.meta}'
---

# Orbit — Design Spine

> Single-surface responsive web (~320px → desktop). No UI component library inherited — a small, from-scratch visual identity in React + Vite, built to keep a fast, reliable core loop first and a three.js backdrop second. Paired with `EXPERIENCE.md` (Orbit experience spine). Both spines win on conflict with any mock or import.

## Brand & Style

Orbit is a personal Todo list that happens to float in space. The whole product is one screen: an input, a list, a way to clear what's done. Its entire reason to feel special is the **Backdrop** — a slow drift of cube-shaped "stars" across a deep-space void, rendered in three.js — and the discipline that this delight never taxes the core loop.

So the visual language is deliberately quiet. The interface is a single translucent panel floating over the void; everything on it is typography, one cool accent, and a lot of calm. There is no decorative chrome competing with the stars: no gradients on buttons, no shadows used as ornament, no color-coding by category. The stars are the only spectacle. Everything else gets out of the way.

The posture is **dark-first and dark-only** — floating in space is intrinsically a dark metaphor, and committing to it lets the panel-over-void contrast be tuned once and verified for WCAG AA. `[ASSUMPTION: no light theme in v1; the cosmic surface is dark by nature. Flagged as an open question — see EXPERIENCE.md Open Questions.]`

## Colors

The palette is two deep blue-blacks for the void, a small ladder of raised blue-grey surfaces for the panel and its controls, near-white ink, and exactly one cool accent.

- **Void (`surface-void #070A14`, `surface-void-far #0B1020`)** — the deep-space base. `surface-void` is the base fill and the WebGL-unavailable fallback color; `surface-void-far` is the subtle radial-gradient falloff toward the edges that gives depth even when the animation is off.
- **Scrim (`surface-scrim #0E1324`)** — the floating panel behind the list. Applied at **~72% opacity** over the Backdrop (`panel.background-opacity`). This is the load-bearing accessibility device: it guarantees Todo text sits on a near-solid dark field, not directly on moving stars, so contrast is stable regardless of what drifts behind it.
- **Raised (`surface-raised #161C31`, `surface-raised-hover #1E2540`)** — the add-input fill and the row hover/press fill. One step up in luminance from the scrim; the only way surfaces separate here is tone, never a heavy border.
- **Ink (`ink-primary #EEF1FA`, `ink-secondary #A7AFC8`)** — near-white primary text (≥ 7:1 on the scrim) and a muted blue-grey for placeholders, timestamps, counts, and the Clear-completed label.
- **Completed ink (`ink-completed #727C99`)** — the de-emphasized text color for a completed Todo. Held **at or above 4.5:1** on the scrim so completed items stay legible, not decorative ghosts. Pairs with a strikethrough and reduced weight, never with opacity so low it drops below AA.
- **Accent (`accent #7AA8FF`, `accent-strong #9CC0FF`)** — one starlight blue. Used only for: the checked checkbox fill, the input focus ring / caret, the undo-toast action, and hover on the Clear label. Never for decoration, never as a fill behind text. `accent-ink #07122B` is the dark ink placed *on* the accent (the checkmark).
- **Danger (`danger #FF8A8A`)** — a soft, desaturated red for inline validation and error messages only. Text-weight, not a fill; the app is a calm surface, not an alarm.
- **Star cubes (`star-cube #8FB2FF`, `star-cube-dim #39456E`)** — decorative only; the drifting cubes range from bright (near ones) to dim (far ones). Carry no data and never sit behind text.

Avoid: any second accent hue, category/priority color-coding, saturated fills behind text, and communicating completion by color alone (it must also carry the checkbox state and strikethrough — see Do's and Don'ts).

## Typography

One family — **Inter**, with a system-ui fallback stack for instant first paint if the webfont is still loading (the core loop must never wait on type). All roles are the same family; hierarchy comes from size and weight, not from a second typeface.

- **`title` (22px / 600)** — the app title only ("Todos"). Set once, top of the panel.
- **`input` (17px / 400)** — the add field. Slightly larger than body so the capture moment feels roomy and the 16px+ size avoids mobile-Safari zoom-on-focus.
- **`body` (16px / 400)** — the Todo description. The workhorse. Wraps to multiple lines for long descriptions; never truncates content the user typed.
- **`meta` (13px / 400)** — timestamps, the completed count, empty/error microcopy, toast text.
- **`button` (14px / 500, tracked +0.01em)** — the Clear-completed label and toast action.

No display sizes, no all-caps headers, no italics. Dynamic scaling: layout must survive a 200% browser zoom and honor user font-size settings without clipping controls.

## Layout & Spacing

Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48 px. Tight spacing (`{spacing.2}`–`{spacing.3}`) between a checkbox and its label and between stacked rows; large spacing (`{spacing.5}`–`{spacing.7}`) between the panel's major zones (title → input → list → footer).

The panel is a **single centered column**, capped at `panel-max-width` (560px), floating vertically toward the upper-middle of the viewport so the void reads as space around it. It never spans the full desktop width — the empty void margins are the point.

- **Desktop / tablet:** centered panel, generous void margin on all sides.
- **Mobile (down to 320px):** panel takes the full width minus a 16px (`{spacing.4}`) gutter each side; the void shows only at top and bottom. Vertical rhythm holds; nothing is compressed to fit.

Single column always. No sidebars, no multi-pane. There is only one surface.

## Elevation & Depth

Depth here is literal, not metaphorical — the list genuinely floats over a 3D field. So elevation is expressed by the **translucent scrim panel** lifting off the animated void, plus one soft ambient shadow beneath the panel to seat it in space. That is the only shadow in the product.

Controls (input, rows, checkbox) do **not** cast shadows; they separate from the panel by tone (`surface-raised` vs `surface-scrim`) and by the hairline border. Hover/press states shift fill tone, never elevation. No shadow is ever used purely for hierarchy.

## Shapes

Soft, not pill. `{rounded.sm}` (8px) for the checkbox, todo rows, and the Clear button; `{rounded.md}` (14px) for the add-input and the toast; `{rounded.lg}` (20px) for the floating panel itself — a slightly softer corner reads as a calm object adrift, not a hard UI card. Nothing fully round except, optionally, nothing — even the checkbox is a soft square so the "check off a box" metaphor is unmistakable.

## Components

- **Panel** — the floating surface. `surface-scrim` at ~72% opacity, `{rounded.lg}` corners, 1px `border-hairline`, one soft ambient shadow beneath. Holds title, input, list, footer. Its translucency is what makes the stars visible around and faintly behind it while keeping text legible.
- **Add-input** — full-width field at the top of the panel, `surface-raised` fill, `{rounded.md}`, `ink-primary` text, `ink-secondary` placeholder ("What needs doing?"). Focus draws a 2px `border-focus` ring at AA contrast against the panel. Submit is Enter; there is no separate visible button required, though an inline enter-affordance is permitted. Caret and focus ring use `accent`.
- **Todo row** — a checkbox, the description in `body`, and a delete affordance. `{rounded.sm}`, hairline divider between rows, `surface-raised-hover` fill on hover/focus. Active vs completed appearance is the core visual signal — see Do's and Don'ts.
- **Checkbox** — soft-square, `{rounded.sm}`. Idle: 2px `ink-secondary` border, transparent fill. Checked: `accent` fill with an `accent-ink` checkmark. Minimum 24px visual box inside a ≥ 44px touch target. Focus ring in `border-focus`.
- **Delete affordance** — a low-emphasis icon button (×) in `ink-secondary`, becoming `ink-primary`/`danger` on hover/focus. Visible on hover on pointer devices; **always visible on touch** (no hover-only affordance on small screens). ≥ 44px target.
- **Clear-completed button** — ghost/text button in the footer, `button` type, `ink-secondary` → `ink-primary` on hover. No fill, no border. Disabled/absent when zero completed.
- **Undo toast** — transient bar, `surface-raised` fill, `{rounded.md}`, `ink-primary` text with an `accent-strong` "Undo" action. Auto-dismisses (~6s); pauses on hover/focus. This is the Clear-completed safety net (see EXPERIENCE.md).
- **Inline error** — `danger` text in `meta` size, placed directly under the input (validation) or under the list header (load/action failure) with a retry link. Never a modal, never a full-screen error.
- **Skeleton row** — 3–5 shimmer placeholders in `surface-raised` matching row height, shown while the List loads. Resolves to rows, empty state, or error.
- **Backdrop** — full-viewport fixed layer behind the panel: the three.js cube-star field over `surface-void`. Purely decorative, `aria-hidden`, non-interactive, carries no data. Degrades to a static starfield (reduced motion) or a plain `surface-void`→`surface-void-far` radial gradient (no WebGL). Full behavioral spec in EXPERIENCE.md.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Signal completion with **three** cues at once: checked box + strikethrough + `ink-completed` ink | Convey completion by color/opacity alone (fails color-blind + AA) |
| Keep completed items **in place**, only restyled | Reorder, group, or drop completed items to the bottom |
| Put Todo text on the `~72%` `surface-scrim` panel | Render Todo text directly over the moving star field |
| One accent (`accent`), used only on checked box, focus, and toast action | Introduce a second hue or color-code by anything |
| Let the void margins breathe; cap the panel at 560px | Stretch the panel full-width and fill the screen with UI |
| One ambient shadow, under the panel only | Use shadows on rows/buttons as decoration or hierarchy |
| Fall back to static starfield / plain gradient cleanly | Let a missing WebGL context or reduced-motion break the loop |
| Keep completed ink ≥ 4.5:1 on the scrim | Ghost completed text so faint it drops below AA |
