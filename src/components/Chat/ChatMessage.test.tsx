import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ChatMessage from './ChatMessage';
import type { ChatMessage as ChatMessageType } from '../../lib/chatTypes';

afterEach(() => {
  cleanup();
});

function message(overrides: Partial<ChatMessageType>): ChatMessageType {
  return {
    id: 'message-1',
    role: 'assistant',
    content: 'An answer.',
    ...overrides,
  };
}

describe('ChatMessage', () => {
  it('renders user content as text instead of interpreting markdown', () => {
    render(<ChatMessage message={message({ role: 'user', content: '**not bold**' })} />);

    expect(screen.getByText('**not bold**')).toBeInTheDocument();
    expect(screen.queryByRole('strong')).not.toBeInTheDocument();
  });

  it('renders assistant markdown links with safe external-link attributes', () => {
    render(
      <ChatMessage
        message={message({ content: '[the reference](https://example.test/reference)' })}
      />,
    );

    const link = screen.getByRole('link', { name: 'the reference' });
    expect(link).toHaveAttribute('href', 'https://example.test/reference');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders fenced code through the static chat code block', () => {
    render(
      <ChatMessage
        message={message({ content: '```mux\nlet answer = 42\n```' })}
      />,
    );

    expect(screen.getByText('let answer = 42')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('links assistant sources to the canonical documentation site safely', () => {
    render(
      <ChatMessage
        message={
          message({
            sources: [
              { title: 'Overview', path: '/docs/reference/overview' },
              { title: 'Functions', path: '/docs/language-guide/functions' },
            ],
          })
        }
      />,
    );

    const overview = screen.getByRole('link', { name: 'Overview' });
    expect(overview).toHaveAttribute('href', 'https://mux-lang.dev/docs/reference/overview');
    expect(overview).toHaveAttribute('target', '_blank');
    expect(overview).toHaveAttribute('rel', 'noopener noreferrer');
    expect(screen.getByRole('link', { name: 'Functions' })).toHaveAttribute(
      'href',
      'https://mux-lang.dev/docs/language-guide/functions',
    );
  });

  it('does not render source metadata for user messages', () => {
    render(
      <ChatMessage
        message={
          message({
            role: 'user',
            content: 'Where are maps documented?',
            sources: [{ title: 'Maps', path: '/docs/tour/maps' }],
          })
        }
      />,
    );

    expect(screen.getByText('Where are maps documented?')).toBeInTheDocument();
    expect(screen.queryByText('Sources')).not.toBeInTheDocument();
  });
});
