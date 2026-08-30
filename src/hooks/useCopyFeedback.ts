import { useCallback, useEffect, useRef, useState } from 'react';

interface CopyFeedback {
  readonly copied: boolean;
  readonly announcement: string;
  readonly copy: () => void;
}

export default function useCopyFeedback(text: string): CopyFeedback {
  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(0);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
  }, []);

  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setCopyCount((count) => count + 1);
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
          setCopied(false);
          resetTimer.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard write failed, for example in a non-HTTPS context.
      });
  }, [text]);

  const announcement = copyCount === 0
    ? ''
    : copyCount === 1
      ? 'Copied to clipboard'
      : 'Copied to clipboard again';

  return { copied, announcement, copy };
}
