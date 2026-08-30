import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChatInput from './ChatInput';

afterEach(() => {
  cleanup();
});

describe('ChatInput', () => {
  it('submits content and clears the input', () => {
    const onSend = vi.fn();
    render(React.createElement(ChatInput, { onSend }));
    const input = screen.getByRole('textbox', { name: 'Chat message' });

    fireEvent.change(input, { target: { value: '  Explain maps  ' } });
    fireEvent.submit(input.closest('form')!);

    expect(onSend).toHaveBeenCalledOnce();
    expect(onSend).toHaveBeenCalledWith('  Explain maps  ');
    expect(input).toHaveValue('');
  });

  it('does not submit whitespace-only content', () => {
    const onSend = vi.fn();
    render(React.createElement(ChatInput, { onSend }));
    const input = screen.getByRole('textbox', { name: 'Chat message' });

    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.submit(input.closest('form')!);

    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables input and submission while disabled', () => {
    const onSend = vi.fn();
    render(React.createElement(ChatInput, { onSend, disabled: true }));
    const input = screen.getByRole('textbox', { name: 'Chat message' });

    expect(input).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    fireEvent.submit(input.closest('form')!);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('enforces the Worker content limit in the browser', () => {
    render(React.createElement(ChatInput, { onSend: vi.fn() }));
    expect(screen.getByRole('textbox', { name: 'Chat message' })).toHaveAttribute(
      'maxLength',
      '2000',
    );
  });
});
