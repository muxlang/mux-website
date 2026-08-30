import React, { useEffect, useState } from "react";
import useIsBrowser from "@docusaurus/useIsBrowser";
import { useColorMode } from "@docusaurus/theme-common";
import { highlightCode } from "../../shiki/highlighter";

interface ChatCodeBlockProps {
  code: string;
  language?: string;
}

interface HighlightedCode {
  code: string;
  language: string;
  theme: string;
  html: string;
}

/**
 * Static, non-interactive code block for assistant chat messages. Unlike the
 * site-wide `@theme/CodeBlock`, this never renders the runnable MuxTerminal, so
 * fenced `mux` snippets returned by the assistant show as plain highlighted code
 * that fits inside the narrow chat drawer (see issue #4).
 */
const ChatCodeBlock: React.FC<ChatCodeBlockProps> = ({ code, language }) => {
  const isBrowser = useIsBrowser();
  // Shiki bakes the theme's colors into inline styles, so we must re-highlight
  // when the site's color mode changes rather than snapshot it once.
  const { colorMode } = useColorMode();
  const languageName = language ?? "mux";
  const theme = colorMode === "dark" ? "github-dark" : "github-light";
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    let cancelled = false;

    const render = async () => {
      try {
        const result = await highlightCode(code, languageName, theme);
        if (!cancelled) {
          // highlightCode returns the raw code unchanged when the language is
          // unsupported; only treat it as highlighted markup when it produced
          // a <pre> wrapper.
          setHighlighted(
            result.startsWith("<pre")
              ? { code, language: languageName, theme, html: result }
              : null,
          );
        }
      } catch {
        if (!cancelled) {
          setHighlighted(null);
        }
      }
    };

    render();
    return () => {
      cancelled = true;
    };
  }, [code, languageName, isBrowser, theme]);

  // The highlighter runs asynchronously. Match its result to every input
  // that affects the output before rendering, so a passive effect can never
  // paint markup produced for an older snippet, language, or theme.
  const html =
    highlighted?.code === code &&
    highlighted.language === languageName &&
    highlighted.theme === theme
      ? highlighted.html
      : null;

  if (html) {
    return <div className="mux-chat-code-block" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <pre className="mux-chat-code-block mux-chat-code-block-plain">
      <code>{code}</code>
    </pre>
  );
};

export default ChatCodeBlock;
