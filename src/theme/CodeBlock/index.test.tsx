import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeBlock from './index';

const highlighterMocks = vi.hoisted(() => ({
  getHighlighter: vi.fn(),
  resolveShikiLanguage: vi.fn(() => 'javascript'),
}));
const routeMocks = vi.hoisted(() => ({ pathname: '/' }));

vi.mock('@docusaurus/router', () => ({
  useLocation: () => routeMocks,
}));

vi.mock('@site/src/shiki/highlighter', () => highlighterMocks);

vi.mock('@site/src/components/MuxTerminal', () => ({
  default: ({ initialCode, title }: { initialCode: string; title?: string }) =>
    React.createElement('div', {
      'data-testid': 'mux-terminal',
      'data-code': initialCode,
      'data-title': title,
    }),
}));

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
  routeMocks.pathname = '/';
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

  it('uses the interactive terminal for non-static Mux fences', () => {
    const code = 'func main() {\n  return\n}\n';
    render(
      <CodeBlock language="mux" metastring={'title="example.mux"'}>
        {code}
      </CodeBlock>,
    );

    const terminal = screen.getByTestId('mux-terminal');
    expect(terminal).toHaveAttribute('data-code', code.trimEnd());
    expect(terminal).toHaveAttribute('data-title', 'example.mux');
    expect(screen.queryByText('highlighted')).not.toBeInTheDocument();
  });

  it('keeps static Mux fences as highlighted code blocks', async () => {
    const code = 'func main() {\n  return\n}';
    const { container } = render(
      <CodeBlock language="mux" metastring={'static title="example.mux"'}>
        {code}
      </CodeBlock>,
    );

    expect(screen.queryByTestId('mux-terminal')).not.toBeInTheDocument();
    expect(container.querySelector('.terminal-code')).toHaveAttribute(
      'data-filename',
      'example.mux',
    );
    expect(await screen.findByText('highlighted')).toBeInTheDocument();
  });

  it('keeps Mux fences on blog routes as highlighted code blocks', async () => {
    routeMocks.pathname = '/blog/release-notes';
    const { container } = render(
      <CodeBlock language="mux">{'func main() {\n  return\n}'}</CodeBlock>,
    );

    expect(screen.queryByTestId('mux-terminal')).not.toBeInTheDocument();
    expect(container.querySelector('.terminal-code')).toBeInTheDocument();
    expect(await screen.findByText('highlighted')).toBeInTheDocument();
  });
});
