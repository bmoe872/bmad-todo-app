// Story 3.5 (AC4) — the Undo toast's ~6s auto-dismiss must pause on FOCUS, not
// just hover, and its action must be a real focusable button reachable by Tab.
// The countdown itself lives in useClearCompleted; this component reports
// pause/resume via focus/blur (which bubble from the button to the container).

import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { UndoToast, undoToastMessage } from './UndoToast';

function setup() {
  const onUndo = vi.fn();
  const onPause = vi.fn();
  const onResume = vi.fn();
  render(
    <UndoToast count={3} onUndo={onUndo} onPause={onPause} onResume={onResume} />,
  );
  return { onUndo, onPause, onResume };
}

describe('UndoToast — announcement + focusable action', () => {
  it('is announced as a polite status region with the exact "Cleared N completed." copy', () => {
    setup();
    const toast = screen.getByTestId('undo-toast');
    expect(toast).toHaveAttribute('role', 'status');
    expect(toast).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Cleared 3 completed.')).toBeInTheDocument();
    expect(undoToastMessage(3)).toBe('Cleared 3 completed.');
  });

  it('exposes Undo as a real focusable <button> and invokes onUndo when activated', () => {
    const { onUndo } = setup();
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo.tagName).toBe('BUTTON');
    undo.focus();
    expect(document.activeElement).toBe(undo);
    fireEvent.click(undo);
    expect(onUndo).toHaveBeenCalledTimes(1);
  });
});

describe('UndoToast — timer pauses on focus, not just hover (AC4)', () => {
  it('pauses the countdown when keyboard focus enters (focus bubbles from the Undo button)', () => {
    const { onPause, onResume } = setup();
    const undo = screen.getByRole('button', { name: 'Undo' });

    // Tabbing to the Undo button fires focus, which bubbles to the toast.
    fireEvent.focus(undo);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();

    // Leaving resumes the countdown.
    fireEvent.blur(undo);
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('also pauses/resumes on pointer hover (parity with focus)', () => {
    const { onPause, onResume } = setup();
    const toast = screen.getByTestId('undo-toast');

    fireEvent.mouseEnter(toast);
    expect(onPause).toHaveBeenCalledTimes(1);

    fireEvent.mouseLeave(toast);
    expect(onResume).toHaveBeenCalledTimes(1);
  });
});
