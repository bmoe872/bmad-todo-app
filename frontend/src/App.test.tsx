import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

// Colocated placeholder test proving Vitest + Testing Library + v8 coverage
// work. Feature/component tests arrive from Epic 3 onward.
describe('App', () => {
  it('renders the application heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'nearform_todo_app' })).toBeInTheDocument();
  });
});
