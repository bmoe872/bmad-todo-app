import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { InlineError } from './InlineError';

describe('InlineError', () => {
  it('renders the message with a working Retry button when retry is provided', () => {
    const onRetry = vi.fn();
    render(<InlineError message="Couldn't load your list." retryLabel="Retry" onRetry={onRetry} />);

    const btn = screen.getByRole('button', { name: 'Retry' });
    btn.click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load your list.Retry");
  });

  it('renders message-only (no button) when no retry is provided — the mode reused by action-error paths', () => {
    const message = "Couldn't save that — try again.";
    render(<InlineError message={message} />);

    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
