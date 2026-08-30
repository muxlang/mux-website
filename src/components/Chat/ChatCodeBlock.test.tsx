import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatCodeBlock from './ChatCodeBlock';

const highlightCodeMock = vi.hoisted(() => vi.fn());

vi.mock('../../shiki/highlighter', () => ({ highlightCode: highlightCodeMock }));

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  highlightCodeMock.mockReset();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

describe('ChatCodeBlock', () => {
  it('shows plain code until highlighting completes, then renders highlighted HTML', async () => {
    const result = deferred<string>();
    highlightCodeMock.mockReturnValue(result.promise);
    const { container } = render(<ChatCodeBlock code="let answer = 42" language="mux" />);

    expect(container.querySelector('.mux-chat-code-block-plain')).toHaveTextContent(
      'let answer = 42',
    );
    expect(highlightCodeMock).toHaveBeenCalledWith('let answer = 42', 'mux', 'github-dark');

    await act(async () => {
      result.resolve('<pre class="shiki">highlighted code</pre>');
    });
    await waitFor(() => expect(screen.getByText('highlighted code')).toBeInTheDocument());
    expect(container.querySelector('.mux-chat-code-block-plain')).not.toBeInTheDocument();
  });

  it('keeps a plain block when highlighting fails or returns unsupported output', async () => {
    highlightCodeMock.mockRejectedValueOnce(new Error('highlighter unavailable'));
    const { container, rerender } = render(<ChatCodeBlock code="first" />);

    await waitFor(() => expect(container.querySelector('.mux-chat-code-block-plain')).toBeInTheDocument());
    expect(screen.getByText('first')).toBeInTheDocument();

    highlightCodeMock.mockResolvedValueOnce('unsupported source');
    rerender(<ChatCodeBlock code="second" language="unknown" />);
    await waitFor(() => expect(screen.getByText('second')).toBeInTheDocument());
    expect(container.querySelector('.mux-chat-code-block-plain')).toHaveTextContent('second');
  });

  it('does not display stale highlighted code while a changed snippet is pending', async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    highlightCodeMock.mockImplementation((code: string) =>
      code === 'first' ? first.promise : second.promise,
    );
    const { container, rerender } = render(<ChatCodeBlock code="first" />);

    await act(async () => {
      first.resolve('<pre class="shiki">first highlighted</pre>');
    });
    await waitFor(() => expect(screen.getByText('first highlighted')).toBeInTheDocument());

    rerender(<ChatCodeBlock code="second" />);
    expect(container.querySelector('.mux-chat-code-block-plain')).toHaveTextContent('second');
    expect(screen.queryByText('first highlighted')).not.toBeInTheDocument();

    await act(async () => {
      second.resolve('<pre class="shiki">second highlighted</pre>');
    });
    await waitFor(() => expect(screen.getByText('second highlighted')).toBeInTheDocument());
  });
});
