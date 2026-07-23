// Deferred-commit orchestration for Clear-completed (FR-9, AD-7).
//
// The AD-7 model, implemented precisely:
//   1. clear()  — capture the exact id snapshot of currently-completed Todos,
//                 hide them OPTIMISTICALLY in the List cache, start a ~6s timer.
//                 NO server call yet.
//   2. undo()   — pure client-side timer cancel; restore every cleared Todo to
//                 its prior position/state. NO server call.
//   3. commit() — on timeout (or manual dismiss without undo) fire EXACTLY ONE
//                 `DELETE /api/todos/completed` with the captured snapshot, then
//                 reconcile the List to server truth (invalidate).
//
// Because nothing is deleted server-side until commit, a crash/refresh mid-window
// safely restores on reload, and a Todo completed *after* the click is never in
// the snapshot so is never cleared.
//
// This hook owns only the deferred-clear flow. It reads/writes the List through
// the query cache keyed by `todosQueryKey` (AD-6) and does NOT modify useTodos.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { clearCompleted } from '../api/todos';
import type { Todo } from '../types';
import { todosQueryKey } from './useTodos';

/** Undo window duration (~6s per EXPERIENCE.md / AD-7). */
export const CLEAR_UNDO_MS = 6000;

/**
 * Action-error microcopy for a failed bulk delete (EXPERIENCE.md Voice & Tone).
 * Calm, no exclamation/emoji/error codes.
 */
export const CLEAR_ERROR_MESSAGE = "Couldn't save that — try again.";

/** The open undo window's public shape (drives the toast). */
export interface PendingClear {
  /** Number of Todos cleared (toast copy "Cleared N completed. Undo"). */
  count: number;
  /** The captured id snapshot sent to the server on commit. */
  ids: string[];
}

export interface UseClearCompleted {
  /** Non-null while the undo window is open; drives the UndoToast. */
  pending: PendingClear | null;
  /** Last bulk-delete error message, or null. Drives the inline error. */
  error: string | null;
  /** Activate Clear-completed: snapshot + optimistic hide + start timer. */
  clear: () => void;
  /** Cancel the pending timer and restore cleared rows. No server call. */
  undo: () => void;
  /** Pause the auto-dismiss countdown (toast hover/focus). */
  pauseTimer: () => void;
  /** Resume the auto-dismiss countdown (toast unhover/blur). */
  resumeTimer: () => void;
}

export function useClearCompleted(): UseClearCompleted {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<PendingClear | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Deferred-window state kept in refs so the timer callback and the mutation
  // handlers always read the current window without stale closures.
  const timerRef = useRef<number | null>(null);
  const preClearListRef = useRef<Todo[] | null>(null); // full list before hide (for restore)
  const idsRef = useRef<string[]>([]); // the captured id snapshot
  const committedRef = useRef(false); // guards against double-commit / commit-after-undo

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // The deferred server call. Fires once, at commit time only.
  const mutation = useMutation({
    mutationFn: (ids: string[]) => clearCompleted(ids),
    onError: () => {
      // Bulk delete failed: return the cleared rows to their positions and
      // surface a non-blocking inline error (AC5, FR-7).
      if (preClearListRef.current) {
        queryClient.setQueryData<Todo[]>(todosQueryKey, preClearListRef.current);
      }
      setError(CLEAR_ERROR_MESSAGE);
    },
    onSettled: () => {
      // Reconcile the List to true persisted state either way (AD-6/AD-7).
      void queryClient.invalidateQueries({ queryKey: todosQueryKey });
    },
  });

  // Single commit path — the timer funnels here on dismiss. Guarded so it fires
  // the bulk delete at most once and never after an undo.
  const commit = useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    clearTimer();
    setPending(null);
    mutation.mutate(idsRef.current);
  }, [clearTimer, mutation]);

  // The timer callback reads the latest commit through a ref so restarting the
  // timer never captures a stale closure.
  const commitRef = useRef(commit);
  commitRef.current = commit;

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      commitRef.current();
    }, CLEAR_UNDO_MS);
  }, [clearTimer]);

  const clear = useCallback(() => {
    const list = queryClient.getQueryData<Todo[]>(todosQueryKey);
    if (!list) return;
    const cleared = list.filter((t) => t.completed);
    if (cleared.length === 0) return; // inert at zero completed

    // Capture the exact snapshot at click time.
    preClearListRef.current = list;
    idsRef.current = cleared.map((t) => t.id);
    committedRef.current = false;
    setError(null);

    // Optimistic hide: drop completed rows; active rows keep their positions.
    queryClient.setQueryData<Todo[]>(
      todosQueryKey,
      list.filter((t) => !t.completed),
    );

    setPending({ count: cleared.length, ids: idsRef.current });
    startTimer();
  }, [queryClient, startTimer]);

  const undo = useCallback(() => {
    clearTimer();
    committedRef.current = true; // ensure no late timer can commit this window
    if (preClearListRef.current) {
      // Restore exact prior positions and completion states.
      queryClient.setQueryData<Todo[]>(todosQueryKey, preClearListRef.current);
    }
    setPending(null);
  }, [queryClient, clearTimer]);

  // Pause = clear the timeout; Resume = restart the full window (documented,
  // simplest semantic that satisfies "pauses on hover/focus"). While paused the
  // timer cannot fire; leaving the toast starts a fresh ~6s countdown.
  const pauseTimer = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const resumeTimer = useCallback(() => {
    if (committedRef.current) return;
    if (pending === null) return;
    startTimer();
  }, [pending, startTimer]);

  // Never let a pending timer fire after the component unmounts.
  useEffect(() => clearTimer, [clearTimer]);

  return { pending, error, clear, undo, pauseTimer, resumeTimer };
}
