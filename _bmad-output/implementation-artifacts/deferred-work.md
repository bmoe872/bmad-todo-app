# Deferred Work

Items surfaced during reviews that are real but intentionally not actioned in the
originating story. Each entry names its source and a one-line reason.

## Deferred from: code review of story-3.1 (2026-07-23)

- **Empty-state input focus (AC3 clause "with the input focused (desktop)").** The empty state renders, but the desktop autofocus it references cannot be implemented in Story 3.1 because the real add-input does not exist yet — this story ships an `aria-hidden` placeholder slot. Belongs to Story 3.2 (Add-input), which introduces the focusable field and owns its desktop-only autofocus. Focusing the placeholder would be an accessibility anti-pattern.
