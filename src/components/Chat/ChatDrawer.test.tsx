import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatDrawer from './ChatDrawer';
import type { ChatResponse } from '../../lib/chatTypes';

const sendChatMock = vi.hoisted(() => vi.fn());

vi.mock('../../api/chat', () => ({ sendChat: sendChatMock }));

beforeEach(() => {
  let id = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `message-${++id}` });
  sessionStorage.clear();
  sendChatMock.mockReset();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ChatDrawer', () => {
  it('does not render when closed and shows the empty state when opened', () => {
    const onClose = vi.fn();
    const { rerender } = render(<ChatDrawer open={false} onClose={onClose} />);

    expect(screen.queryByRole('dialog', { name: 'Mux AI assistant' })).not.toBeInTheDocument();

    rerender(<ChatDrawer open onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Mux AI assistant' })).toBeInTheDocument();
    expect(screen.getByText(/Ask a question about Mux/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('shows typing state while sending and then renders the assistant response', async () => {
    let resolveResponse: ((response: ChatResponse) => void) | undefined;
    sendChatMock.mockReturnValue(
      new Promise<ChatResponse>((resolve) => {
        resolveResponse = resolve;
      }),
    );
    const onClose = vi.fn();
    render(<ChatDrawer open onClose={onClose} />);
    const input = screen.getByRole('textbox', { name: 'Chat message' });
    const form = input.closest('form');
    if (!form) {
      throw new Error('ChatInput form is missing from ChatDrawer');
    }

    fireEvent.change(input, { target: { value: '  Explain maps  ' } });
    fireEvent.submit(form);

    expect(screen.getByText('Explain maps')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Clear' })).toBeEnabled();
    expect(screen.getByLabelText('Mux AI is typing')).toBeInTheDocument();

    await act(async () => {
      if (!resolveResponse) {
        throw new Error('Chat response resolver was not initialized');
      }
      resolveResponse({ message: 'Maps associate keys with values.' });
    });

    expect(await screen.findByText('Maps associate keys with values.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mux AI is typing')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Chat message' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(sendChatMock).toHaveBeenCalledWith('https://mux-ai.corniedj.workers.dev', [
      { id: 'message-1', role: 'user', content: 'Explain maps' },
    ]);
  });

  it('shows friendly API errors and clears the conversation', async () => {
    sendChatMock.mockResolvedValue({
      error: 'model unavailable',
      errorCode: 'MODEL_UNAVAILABLE',
    } satisfies ChatResponse);
    const onClose = vi.fn();
    render(<ChatDrawer open onClose={onClose} />);
    const input = screen.getByRole('textbox', { name: 'Chat message' });
    const form = input.closest('form');
    if (!form) {
      throw new Error('ChatInput form is missing from ChatDrawer');
    }

    fireEvent.change(input, { target: { value: 'question' } });
    fireEvent.submit(form);

    expect(await screen.findByText(/AI assistant is temporarily unavailable/)).toBeInTheDocument();
    expect(screen.getByText('question')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));

    await waitFor(() => {
      expect(screen.getByText(/Ask a question about Mux/)).toBeInTheDocument();
      expect(screen.queryByText('question')).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Clear' })).toBeDisabled();
  });

  it('disables input and displays the session limit at 25 messages', () => {
    sessionStorage.setItem('mux_chat_message_count', '25');
    const onClose = vi.fn();
    render(<ChatDrawer open onClose={onClose} />);

    expect(screen.getByText(/reached the session message limit/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Chat message' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    expect(sendChatMock).not.toHaveBeenCalled();
  });

  it('passes the close action through to the parent', () => {
    const onClose = vi.fn();
    render(<ChatDrawer open onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Close Mux AI assistant' }));

    expect(onClose).toHaveBeenCalledOnce();
  });
});
