// Shared UI selectors + microcopy, kept in lockstep with the frontend source so
// the specs break loudly if the app's accessible names / test ids / copy drift.
// Sources: frontend/src/components/{AddInput,TodoRow,EmptyState,Footer,UndoToast,
// TodoList}.tsx and Panel.tsx.

import { Locator, Page, expect } from '@playwright/test';

/** Exact microcopy (EXPERIENCE.md Voice & Tone — authoritative). */
export const COPY = {
  emptyState: 'Nothing to do — add something above.',
  loadError: "Couldn't load your list.",
  retry: 'Retry',
  actionError: "Couldn't save that — try again.",
  clearCompleted: 'Clear completed',
  undo: 'Undo',
  addPlaceholder: 'What needs doing?',
  /** Toast leading sentence; the "Undo" button completes it. */
  clearedToast: (n: number) => `Cleared ${n} completed.`,
} as const;

/** Page Object-ish accessors over the single Orbit screen. */
export class OrbitPage {
  constructor(private readonly page: Page) {}

  get addInput(): Locator {
    return this.page.getByLabel('Add a todo');
  }

  get rows(): Locator {
    return this.page.getByTestId('todo-row');
  }

  get emptyState(): Locator {
    return this.page.getByTestId('empty-state');
  }

  get backdrop(): Locator {
    return this.page.getByTestId('backdrop');
  }

  get undoToast(): Locator {
    return this.page.getByTestId('undo-toast');
  }

  get clearCompletedButton(): Locator {
    return this.page.getByRole('button', { name: COPY.clearCompleted });
  }

  get undoButton(): Locator {
    return this.page.getByRole('button', { name: COPY.undo });
  }

  /** A single row by its visible description text. */
  row(description: string): Locator {
    return this.rows.filter({ hasText: description });
  }

  checkbox(description: string): Locator {
    return this.row(description).getByTestId('todo-checkbox');
  }

  /** The 44px label hit-target wrapping the 24px checkbox (TodoRow.tsx). */
  checkHit(description: string): Locator {
    return this.row(description).locator('.orbit-row__check-hit');
  }

  /**
   * Toggle a row's completion by POINTER, the way a user does. We click the
   * label hit-target OFFSET from the centered input rather than the input
   * itself: clicking the nested <input> directly double-fires (the wrapping
   * <label> forwards a second synthetic click, netting no change), whereas a
   * click on the label region forwards exactly one toggle. Keyboard Space (used
   * in the a11y spec) is single-toggle and unaffected.
   */
  async toggle(description: string): Promise<void> {
    await this.checkHit(description).click({ position: { x: 5, y: 22 } });
  }

  deleteButton(description: string): Locator {
    return this.page.getByRole('button', { name: `Delete ${description}` });
  }

  /**
   * Type a description and submit with Enter (the app's create path, FR-1), then
   * wait for the create to SUCCEED — the field clears + refocuses only in the
   * mutation's async onSuccess. Waiting here makes back-to-back captures
   * deterministic: without it, a rapid follow-up `fill()` can be wiped when the
   * PRIOR create's onSuccess reset lands mid-type (submitting empty).
   */
  async addTodo(description: string): Promise<void> {
    await this.addInput.fill(description);
    await this.addInput.press('Enter');
    await expect(this.addInput).toHaveValue('');
  }

  /** Wait for the initial List fetch to resolve to loaded/empty (not skeleton). */
  async waitForListReady(): Promise<void> {
    await expect(async () => {
      const empty = await this.emptyState.count();
      const rows = await this.rows.count();
      expect(empty + rows).toBeGreaterThan(0);
    }).toPass();
  }
}
