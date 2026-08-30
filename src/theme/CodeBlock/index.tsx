import React, { isValidElement, useState, type ReactNode, useEffect } from 'react';
import useIsBrowser from '@docusaurus/useIsBrowser';
import { useLocation } from '@docusaurus/router';
import type { Props } from '@theme/CodeBlock';
import { CopyIcon, CheckIcon } from '@site/src/components/CodeIcons';
import { getHighlighter, resolveShikiLanguage } from '@site/src/shiki/highlighter';
import MuxTerminal from '@site/src/components/MuxTerminal';

function parseLanguage(className: string | undefined): string | undefined {
  if (!className) return undefined;
  const match = className.split(' ').find((str) => str.startsWith('language-'));
  return match?.replace(/language-/, '');
}

function maybeStringifyChildren(children: ReactNode): ReactNode {
  if (React.Children.toArray(children).some((el) => isValidElement(el))) {
    return children;
  }
  return Array.isArray(children) ? children.join('') : (children as string);
}

function getCodeString(rawChildren: ReactNode): string {
  let text = '';
  if (typeof rawChildren === 'string') {
    text = rawChildren;
  } else if (Array.isArray(rawChildren)) {
    text = rawChildren
      .filter((child): child is string => typeof child === 'string')
      .join('');
  }
  return text.trimEnd();
}

function parseMetastring(
  metastring: string | undefined,
): {
  title?: string;
  showLineNumbers?: boolean | number;
  static?: boolean;
} {
  if (!metastring) return {};

  const result: { title?: string; showLineNumbers?: boolean | number; static?: boolean } = {};

  const titleRegex = /title=["']([^"']+)["']/;
  const titleMatch = titleRegex.exec(metastring);
  if (titleMatch) {
    result.title = titleMatch[1];
  }

  if (/(?:^|\s)static(?:\s|$)/.test(metastring)) {
    result.static = true;
  }

  if (metastring.includes('showLineNumbers')) {
    const lineNumRegex = /showLineNumbers=(\d+)/;
    const lineNumMatch = lineNumRegex.exec(metastring);
    if (lineNumMatch) {
      result.showLineNumbers = Number.parseInt(lineNumMatch[1], 10);
    } else {
      result.showLineNumbers = true;
    }
  }

  return result;
}

const LANGUAGE_LABELS: Record<string, string> = {
  mux: 'Mux',
  'source.mux': 'Mux',
  typescript: 'TypeScript',
  ts: 'TypeScript',
  javascript: 'JavaScript',
  js: 'JavaScript',
  bash: 'Bash',
  sh: 'Bash',
  shell: 'Bash',
  console: 'Bash',
  powershell: 'PowerShell',
  ps1: 'PowerShell',
  pwsh: 'PowerShell',
  hm: 'HM',
  text: 'Output',
  plaintext: 'Output',
};

interface HighlightedCode {
  key: string;
  html: string;
}

function languageLabel(lang: string | undefined): string {
  if (!lang) return 'Code';
  const key = lang.trim().toLowerCase();
  return LANGUAGE_LABELS[key] ?? key.toUpperCase();
}

function isMultilineCode(children: ReactNode): children is string {
  return typeof children === 'string' && children.includes('\n');
}

function shouldUseMuxTerminal(
  detectedLang: string | undefined,
  isStatic: boolean | undefined,
  isBlogRoute: boolean,
): boolean {
  const isMuxLanguage = detectedLang === 'mux' || detectedLang === 'source.mux';
  return isMuxLanguage && !isStatic && !isBlogRoute;
}

function makeHighlightKey(
  children: ReactNode,
  detectedLang: string | undefined,
  className: string | undefined,
  isDark: boolean | null,
  isMuxCode: boolean,
): string | null {
  if (!isMultilineCode(children)) return null;
  return JSON.stringify([children, detectedLang, className, isDark, isMuxCode]);
}

function getThemeFromBody(): 'github-dark' | 'github-light' {
  if (typeof document !== 'undefined') {
    return document.body.classList.contains('theme-dark') ||
           document.documentElement.dataset.theme === 'dark'
      ? 'github-dark'
      : 'github-light';
  }
  return 'github-light';
}

function useTheme(isBrowser: boolean): boolean | null {
  const [isDark, setIsDark] = useState<boolean | null>(() =>
    typeof document === 'undefined' ? null : getThemeFromBody() === 'github-dark',
  );

  useEffect(() => {
    if (!isBrowser) return undefined;

    const observer = new MutationObserver(() => {
      setIsDark(getThemeFromBody() === 'github-dark');
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class'],
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, [isBrowser]);

  return isDark;
}

function canHighlight({
  children,
  isBrowser,
  isDark,
  isMuxCode,
}: Pick<Parameters<typeof useHighlightedCode>[0], 'children' | 'isBrowser' | 'isDark' | 'isMuxCode'>): boolean {
  return (
    !isMuxCode &&
    isBrowser &&
    isDark !== null &&
    typeof children === 'string' &&
    children.includes('\n')
  );
}

async function highlightCode(
  code: string,
  detectedLang: string | undefined,
  theme: 'github-dark' | 'github-light',
): Promise<string | null> {
  const effectiveLang = resolveShikiLanguage(detectedLang || 'mux');
  if (!effectiveLang) return null;

  const highlighter = await getHighlighter();
  return highlighter.codeToHtml(code, {
    lang: effectiveLang,
    theme,
  });
}

function useHighlightedCode({
  children,
  detectedLang,
  isBrowser,
  isDark,
  isMuxCode,
  highlightKey,
}: {
  children: ReactNode;
  detectedLang: string | undefined;
  isBrowser: boolean;
  isDark: boolean | null;
  isMuxCode: boolean;
  highlightKey: string | null;
}): HighlightedCode | null {
  const [highlighted, setHighlighted] = useState<HighlightedCode | null>(null);

  useEffect(() => {
    if (!canHighlight({ children, isBrowser, isDark, isMuxCode })) return undefined;

    const trimmedCode = (children as string).trimEnd();
    const theme = isDark ? 'github-dark' : 'github-light';
    const requestKey = highlightKey;
    let active = true;

    const doHighlight = async () => {
      try {
        const html = await highlightCode(trimmedCode, detectedLang, theme);
        if (!html) {
          setHighlighted(null);
          return;
        }
        if (active && requestKey) {
          setHighlighted({ key: requestKey, html });
        }
      } catch (err) {
        console.error('Highlighting error:', err);
      }
    };

    doHighlight();

    return () => {
      active = false;
    };
  }, [children, detectedLang, highlightKey, isBrowser, isDark, isMuxCode]);

  return highlighted;
}

interface MultilineCodeBlockProps {
  readonly children: string;
  readonly className: string | undefined;
  readonly copied: boolean;
  readonly highlighted: HighlightedCode | null;
  readonly highlightKey: string | null;
  readonly onCopy: () => void;
  readonly terminalTitle: string;
}

function MultilineCodeBlock({
  children,
  className,
  copied,
  highlighted,
  highlightKey,
  onCopy,
  terminalTitle,
}: MultilineCodeBlockProps): ReactNode {
  return (
    <div className={`terminal-code ${className || ''}`} data-filename={terminalTitle}>
      <div className="terminal-buttons">
        <button
          className="terminal-copy-button"
          onClick={onCopy}
          aria-label={copied ? 'Copied' : 'Copy code to clipboard'}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          type="button"
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      </div>
      {highlighted?.key === highlightKey ? (
        <div className="shiki-wrapper" dangerouslySetInnerHTML={{ __html: highlighted.html }} />
      ) : (
        <pre className="shiki-pre">
          <code>{children.trimEnd()}</code>
        </pre>
      )}
    </div>
  );
}

export default function CodeBlock({
  children: rawChildren,
  title: titleProp,
  className,
  language,
  showLineNumbers: _showLineNumbersProp,
  metastring,
  ...props
}: Props): ReactNode {
  const [copied, setCopied] = useState(false);
  const isBrowser = useIsBrowser();
  const { pathname } = useLocation();
  const isBlogRoute = pathname.startsWith('/blog');

  // Read the real theme directly off the DOM (Docusaurus sets it via an
  // inline script before hydration) rather than gating on useIsBrowser(),
  // which is still false on this component's first client render. Waiting
  // on that flag left isDark stuck at null until some unrelated DOM mutation
  // happened to trip the observer below - the async highlight effect (guarded
  // on `isDark !== null`) could then never run, leaving code unhighlighted.
  const isDark = useTheme(isBrowser);

  const parsedMeta = parseMetastring(metastring);
  const title = titleProp || parsedMeta.title;

  const children = maybeStringifyChildren(rawChildren);

  const detectedLang = language || parseLanguage(className);
  // Blog posts and any fence marked "static" get the same non-interactive
  // terminal rendering as every other language - a page full of separate
  // Monaco editors is heavier than a blog post needs.
  const isMuxCode = shouldUseMuxTerminal(detectedLang, parsedMeta.static, isBlogRoute);
  const terminalTitle = typeof title === 'string' ? title : languageLabel(detectedLang);
  const highlightKey = makeHighlightKey(children, detectedLang, className, isDark, isMuxCode);

  const handleCopy = () => {
    const textToCopy = getCodeString(rawChildren);
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // Clipboard write failed (e.g., non-HTTPS context)
    });
  };

  const highlighted = useHighlightedCode({
    children,
    detectedLang,
    isBrowser,
    isDark,
    isMuxCode,
    highlightKey,
  });

  if (isMuxCode && typeof children === 'string') {
    return <MuxTerminal initialCode={children.trimEnd()} title={terminalTitle} />;
  }

  if (isMultilineCode(children)) {
    return (
      <MultilineCodeBlock
        className={className}
        copied={copied}
        highlighted={highlighted}
        highlightKey={highlightKey}
        onCopy={handleCopy}
        terminalTitle={terminalTitle}
      >
        {children}
      </MultilineCodeBlock>
    );
  }

  return (
    <code {...props} className={className}>
      {children}
    </code>
  );
}
