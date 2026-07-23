// Composition root for the Orbit single screen. Thin by design: it lays out the
// backdrop placeholder behind the floating Panel and mounts the List. No login,
// signup, or onboarding is ever rendered (FR-4) — the List is the first and
// only screen.

import { Backdrop } from './backdrop/Backdrop';
import { Panel } from './components/Panel';
import { TodoList } from './components/TodoList';

export function App() {
  return (
    <>
      <Backdrop />
      <main className="orbit-app">
        <Panel>
          <TodoList />
        </Panel>
      </main>
    </>
  );
}
