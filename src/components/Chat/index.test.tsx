import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import Chat from './index';

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

describe('Chat', () => {
  it('opens the assistant drawer and returns to the launcher after closing', () => {
    render(<Chat />);

    const launcher = screen.getByRole('button', { name: 'Open Mux AI assistant' });
    expect(launcher).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Mux AI assistant' })).not.toBeInTheDocument();

    fireEvent.click(launcher);
    expect(screen.getByRole('dialog', { name: 'Mux AI assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open Mux AI assistant' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Close Mux AI assistant' }));
    expect(screen.getByRole('button', { name: 'Open Mux AI assistant' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Mux AI assistant' })).not.toBeInTheDocument();
  });
});
