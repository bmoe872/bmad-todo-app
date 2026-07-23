// Composition root for the Orbit single screen. Thin by design: it lays out the
// backdrop placeholder behind the floating Panel and mounts the List. No login,
// signup, or onboarding is ever rendered (FR-4) — the List is the first and
// only screen.

import { Backdrop } from './backdrop/Backdrop';
import { BackdropBoundary } from './backdrop/BackdropBoundary';
import { Footer } from './components/Footer';
import { Panel } from './components/Panel';
import { TodoList } from './components/TodoList';
import { UndoToast } from './components/UndoToast';
import { useClearCompleted } from './hooks/useClearCompleted';

export function App() {
  // Clear-completed deferred-commit flow (FR-9, AD-7). Owned here so the Footer
  // (rendered into the panel footer slot) and the UndoToast (rendered as a
  // bottom overlay) share one window without useTodos being touched.
  const clear = useClearCompleted();

  return (
    <>
      {/* AD-8: the error boundary contains any backdrop failure so it can never
          take down the core loop (which lives in the sibling <main>). */}
      <BackdropBoundary>
        <Backdrop />
      </BackdropBoundary>
      <main className="orbit-app">
        <Panel
          footerSlot={<Footer onClear={clear.clear} error={clear.error} />}
          toastSlot={
            clear.pending ? (
              <UndoToast
                count={clear.pending.count}
                onUndo={clear.undo}
                onPause={clear.pauseTimer}
                onResume={clear.resumeTimer}
              />
            ) : null
          }
        >
          <TodoList />
        </Panel>
      </main>
    </>
  );
}
