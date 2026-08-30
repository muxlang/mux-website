import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import useMuxExecutor from './useMuxExecutor';

vi.mock('@docusaurus/useDocusaurusContext', () => ({
  default: () => ({
    siteConfig: { customFields: { apiUrl: 'https://worker.example.test/' } },
  }),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useMuxExecutor', () => {
  it('posts source code and returns successful output', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ output: 'Hello, world!' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { result } = renderHook(() => useMuxExecutor());

    let response;
    await act(async () => {
      response = await result.current.executeCode('println("Hello, world!")');
    });

    expect(response).toEqual({ output: 'Hello, world!' });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith('https://worker.example.test/api/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'println("Hello, world!")' }),
    });
  });

  it('exposes a server error from a JSON response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: 'Compilation failed' }), {
        status: 400,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { result } = renderHook(() => useMuxExecutor());

    await act(async () => {
      await result.current.executeCode('invalid');
    });

    expect(result.current.error).toBe('Compilation failed');
  });

  it('maps rate limits and empty responses to actionable errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(new Response('slow down', { status: 429 }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 }));
    const { result } = renderHook(() => useMuxExecutor());

    await act(async () => {
      await result.current.executeCode('first');
    });
    expect(result.current.error).toBe('Too many requests. Please wait and try again.');

    await act(async () => {
      await result.current.executeCode('second');
    });
    expect(result.current.error).toBe('Request failed (503)');
  });

  it('rejects a successful response without output or error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const { result } = renderHook(() => useMuxExecutor());

    let response;
    await act(async () => {
      response = await result.current.executeCode('source');
    });

    expect(response).toEqual({ error: 'Server returned an unexpected response' });
    expect(result.current.error).toBe('Server returned an unexpected response');
  });

  it('converts a network failure into a user-visible error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network unavailable'));
    const { result } = renderHook(() => useMuxExecutor());

    let response;
    await act(async () => {
      response = await result.current.executeCode('source');
    });

    expect(response).toEqual({ error: 'Network unavailable' });
    expect(result.current.error).toBe('Network unavailable');
    expect(result.current.loading).toBe(false);
  });
});
