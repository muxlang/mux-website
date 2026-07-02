import React, { useEffect, useState } from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';
import { highlightCode } from '../../shiki/highlighter';

interface ChatCodeBlockProps {
  code: string;
  language?: string;
}

function getThemeFromBody(): 'github-dark' | 'github-light' {
  if (typeof document !== 'undefined') {
    return document.documentElement.dataset.theme === 'dark' ||
      document.body.classList.contains('theme-dark')
      ? 'github-dark'
      : 'github-light';
  }
  return 'github-light';
}

/**
 * Static, non-interactive code block for assistant chat messages. Unlike the
 * site-wide `@theme/CodeBlock`, this never renders the runnable MuxTerminal, so
 * fenced `mux` snippets returned by the assistant show as plain highlighted code
 * that fits inside the narrow chat drawer (see issue #4).
 */
const ChatCodeBlock: React.FC<ChatCodeBlockProps> = ({ code, language }) => {
  const isBrowser = useIsBrowser();
  const [html, setHtml] = useState<string | null>(null);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    let cancelled = false;

    const render = async () => {
      try {
        const result = await highlightCode(code, language ?? 'mux', getThemeFromBody());
        if (!cancelled) {
          // highlightCode returns the raw code unchanged when the language is
          // unsupported; only treat it as highlighted markup when it produced
          // a <pre> wrapper.
          setHtml(result.startsWith('<pre') ? result : null);
        }
      } catch {
        if (!cancelled) {
          setHtml(null);
        }
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [code, language, isBrowser]);

  if (html) {
    return (
      <div className="mux-chat-code-block" dangerouslySetInnerHTML={{ __html: html }} />
    );
  }

  return (
    <pre className="mux-chat-code-block mux-chat-code-block-plain">
      <code>{code}</code>
    </pre>
  );
};

export default ChatCodeBlock;
