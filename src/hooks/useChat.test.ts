import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useChat from './useChat';
import type { ChatResponse } from '../lib/chatTypes';

const sendChatMock = vi.hoisted(() => vi.fn());

vi.mock('../api/chat', () => ({ sendChat: sendChatMock }));
vi.mock('@docusaurus/useDocusaurusContext', () => ({
  default: () => ({
    siteConfig: { customFields: { aiApiUrl: 'https://worker.example.test/' } },
  }),
}));

beforeEach(() => {
  let id = 0;
  vi.stubGlobal('crypto', { randomUUID: () => `message-${++id}` });
  sessionStorage.clear();
  sendChatMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('useChat', () => {
  it('trims the user message and appends the assistant response', async () => {
    sendChatMock.mockResolvedValue({
      message: 'Mux is a programming language.',
      sources: [{ title: 'Overview', path: '/docs/reference/overview' }],
    } satisfies ChatResponse);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('  What is Mux?  ');
    });

    expect(sendChatMock).toHaveBeenCalledOnce();
    expect(sendChatMock).toHaveBeenCalledWith('https://worker.example.test/', [
      { id: 'message-1', role: 'user', content: 'What is Mux?' },
    ]);
    expect(result.current.messages).toEqual([
      { id: 'message-1', role: 'user', content: 'What is Mux?' },
      {
        id: 'message-2',
        role: 'assistant',
        content: 'Mux is a programming language.',
        sources: [{ title: 'Overview', path: '/docs/reference/overview' }],
      },
    ]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('sets loading immediately and clears a prior error for a pending request', async () => {
    sendChatMock.mockRejectedValueOnce(new Error('first request failed'));
    let resolvePending!: (response: ChatResponse) => void;
    sendChatMock.mockReturnValueOnce(
      new Promise<ChatResponse>((resolve) => {
        resolvePending = resolve;
      }),
    );
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('first');
    });
    expect(result.current.error).toBe('first request failed');

    let pendingRequest!: Promise<void>;
    act(() => {
      pendingRequest = result.current.sendMessage('second');
    });
    expect(result.current.loading).toBe(true);
    expect(result.current.error).toBeNull();

    await act(async () => {
      resolvePending({ message: 'second response' });
      await pendingRequest;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('maps known API error codes to user-facing copy', async () => {
    sendChatMock.mockResolvedValue({
      error: 'rate limited',
      errorCode: 'RATE_LIMIT',
    } satisfies ChatResponse);
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('question');
    });

    expect(result.current.error).toBe('Please wait a moment before sending another message.');
    expect(result.current.messages).toEqual([
      { id: 'message-1', role: 'user', content: 'question' },
    ]);
  });

  it('allows exactly 25 messages per browser session', async () => {
    sendChatMock.mockResolvedValue({ message: 'ok' } satisfies ChatResponse);
    const { result } = renderHook(() => useChat());

    for (let message = 1; message <= 25; message += 1) {
      await act(async () => {
        await result.current.sendMessage(`message ${message}`);
      });
    }

    expect(sendChatMock).toHaveBeenCalledTimes(25);
    expect(result.current.sessionLimitReached).toBe(true);
    await act(async () => {
      await result.current.sendMessage('message 26');
    });
    expect(sendChatMock).toHaveBeenCalledTimes(25);
  });

  it('does not send blank content and can clear the conversation', async () => {
    const { result } = renderHook(() => useChat());

    await act(async () => {
      await result.current.sendMessage('   ');
    });
    expect(sendChatMock).not.toHaveBeenCalled();

    sendChatMock.mockResolvedValue({ message: 'ok' } satisfies ChatResponse);
    await act(async () => {
      await result.current.sendMessage('question');
    });
    expect(result.current.messages).not.toHaveLength(0);

    act(() => result.current.clearConversation());
    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
