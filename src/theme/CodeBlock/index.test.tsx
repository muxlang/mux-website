import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeBlock from './index';

const highlighterMocks = vi.hoisted(() => ({
  getHighlighter: vi.fn(),
  resolveShikiLanguage: vi.fn(() => 'javascript'),
}));

vi.mock('@docusaurus/router', () => ({
  useLocation: () => ({ pathname: '/' }),
}));

vi.mock('@site/src/shiki/highlighter', () => highlighterMocks);

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

interface Highlighter {
  codeToHtml: () => string;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

beforeEach(() => {
  highlighterMocks.getHighlighter.mockReset();
  highlighterMocks.resolveShikiLanguage.mockReset();
  highlighterMocks.resolveShikiLanguage.mockReturnValue('javascript');
  highlighterMocks.getHighlighter.mockResolvedValue({
    codeToHtml: () => '<span>highlighted</span>',
  });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
  document.body.className = '';
  document.documentElement.dataset.theme = 'light';
});

afterEach(() => {
  cleanup();
  document.body.className = '';
  delete document.documentElement.dataset.theme;
});

describe('CodeBlock', () => {
  it('does not display stale highlighting when code changes during an async request', async () => {
    const firstRequest = deferred<Highlighter>();
    const secondRequest = deferred<Highlighter>();
    highlighterMocks.getHighlighter
      .mockReturnValueOnce(firstRequest.promise)
      .mockReturnValueOnce(secondRequest.promise);

    const firstCode = 'const first = 1;\nconsole.log(first);';
    const secondCode = 'const second = 2;\nconsole.log(second);';
    const firstHighlighter = { codeToHtml: () => '<span>first highlight</span>' };
    const secondHighlighter = { codeToHtml: () => '<span>second highlight</span>' };
    const { container, rerender } = render(
      <CodeBlock language="javascript">{firstCode}</CodeBlock>,
    );

    expect(container.querySelector('.shiki-wrapper')).not.toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent(/const first = 1;\s*console\.log\(first\);/);
    await waitFor(() => expect(highlighterMocks.getHighlighter).toHaveBeenCalledOnce());

    rerender(<CodeBlock language="javascript">{secondCode}</CodeBlock>);
    expect(container.querySelector('.shiki-wrapper')).not.toBeInTheDocument();
    expect(container.querySelector('pre code')).toHaveTextContent(/const second = 2;\s*console\.log\(second\);/);
    await waitFor(() => expect(highlighterMocks.getHighlighter).toHaveBeenCalledTimes(2));

    await act(async () => {
      secondRequest.resolve(secondHighlighter);
    });
    await waitFor(() => {
      const wrapper = container.querySelector('.shiki-wrapper');
      expect(wrapper).not.toBeNull();
      expect(wrapper).toHaveTextContent('second highlight');
    });

    await act(async () => {
      firstRequest.resolve(firstHighlighter);
    });
    expect(container.querySelector('.shiki-wrapper')).toHaveTextContent('second highlight');
  });

  it('copies trimmed source and reports the copied state', async () => {
    const code = 'const answer = 42;\nreturn answer;\n  ';
    render(<CodeBlock language="javascript">{code}</CodeBlock>);

    fireEvent.click(screen.getByTitle('Copy to clipboard'));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(code.trimEnd());
    expect(await screen.findByTitle('Copied!')).toBeInTheDocument();
  });

  it('keeps the copy control unchanged when the clipboard rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard unavailable'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    render(<CodeBlock language="javascript">{'const answer = 42;\nreturn answer;'}</CodeBlock>);

    fireEvent.click(screen.getByTitle('Copy to clipboard'));

    await expect(writeText.mock.results[0]?.value).rejects.toThrow('clipboard unavailable');
    expect(screen.queryByTitle('Copied!')).not.toBeInTheDocument();
    expect(screen.getByTitle('Copy to clipboard')).toBeInTheDocument();
  });
});
