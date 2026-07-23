// The always-visible capture field that fills the Panel's add-input slot
// (UX-DR3, EXPERIENCE.md Interaction inventory). Enter submits a create;
// Escape clears the current text without submitting. Empty/whitespace-only and
// > 500-char (trimmed) input are blocked CLIENT-SIDE with inline microcopy and
// no request. On success the field clears and refocuses; on server error the
// optimistic row rolls back (in the mutation hook), the typed text is preserved,
// and a non-blocking "Couldn't save that — try again." shows under the input.
//
// Autofocus is DESKTOP-ONLY: forcing focus on touch would pop the mobile
// keyboard on open (resolved UX decision). Detected via a fine-pointer/hover
// media query, guarded for environments without `matchMedia` (jsdom).

import { useEffect, useRef, useState } from 'react';

import { useCreateTodo } from '../hooks/useCreateTodo';
import { InlineError } from './InlineError';

// EXACT microcopy — EXPERIENCE.md Voice & Tone table (authoritative). The two
// long strings use an em dash (U+2014). No exclamation marks, no emoji.
export const PLACEHOLDER = 'What needs doing?';
export const EMPTY_MESSAGE = 'Type something first.';
export const TOO_LONG_MESSAGE =
  "That's a bit long — keep it under 500 characters.";
export const CREATE_ERROR_MESSAGE = "Couldn't save that — try again.";

/** Max description length, measured on the trimmed string (mirrors the server). */
export const MAX_LENGTH = 500;

/** True only on a non-touch (fine-pointer, hover-capable) device — desktop. */
function isDesktopPointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function AddInput() {
  const [text, setText] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTodo = useCreateTodo();

  // Desktop-only autofocus on mount (never forced on touch).
  useEffect(() => {
    if (isDesktopPointer()) {
      inputRef.current?.focus();
    }
  }, []);

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const trimmed = text.trim();

    // Client-side guards (fast fail; the server validates identically, AD-5).
    if (trimmed.length === 0) {
      setMessage(EMPTY_MESSAGE);
      return;
    }
    if (trimmed.length > MAX_LENGTH) {
      setMessage(TOO_LONG_MESSAGE);
      return;
    }

    setMessage(null);
    createTodo.mutate(trimmed, {
      onSuccess: () => {
        // Field clears and refocuses so the next task can be captured instantly.
        setText('');
        setMessage(null);
        inputRef.current?.focus();
      },
      onError: () => {
        // Preserve the typed text (do NOT clear) and surface a quiet nudge.
        setMessage(CREATE_ERROR_MESSAGE);
      },
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // Escape clears the current text without submitting (UX-DR3).
    if (event.key === 'Escape') {
      setText('');
      setMessage(null);
    }
  }

  return (
    <form
      className="orbit-add-form"
      onSubmit={handleSubmit}
      data-testid="add-input-slot"
    >
      <input
        ref={inputRef}
        type="text"
        className="orbit-add-input"
        placeholder={PLACEHOLDER}
        aria-label="Add a todo"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        // Single-line capture; the server also rejects embedded newlines.
        autoComplete="off"
      />
      {message ? <InlineError message={message} /> : null}
    </form>
  );
}
