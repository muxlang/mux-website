import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface CopyFeedback {
  readonly copied: boolean;
  readonly announcement: string;
  readonly copy: () => void;
}

export default function useCopyFeedback(text: string): CopyFeedback {
  const payload = useMemo(() => ({ text }), [text]);

  const [feedback, setFeedback] = useState({
    payload,
    copied: false,
    copyCount: 0,
  });
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = null;
    };
  }, [text]);

  const copy = useCallback(() => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setFeedback((previous) => ({
          payload,
          copied: true,
          copyCount: previous.payload === payload ? previous.copyCount + 1 : 1,
        }));
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
          setFeedback((previous) => (
            previous.payload === payload ? { ...previous, copied: false } : previous
          ));
          resetTimer.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard write failed, for example in a non-HTTPS context.
      });
  }, [payload, text]);

  const copied = feedback.payload === payload && feedback.copied;
  let announcement = '';
  if (copied && feedback.copyCount === 1) {
    announcement = 'Copied to clipboard';
  } else if (copied && feedback.copyCount > 1) {
    announcement = 'Copied to clipboard again';
    if (feedback.copyCount > 2) {
      announcement += ` (${feedback.copyCount} times)`;
    }
  }

  return { copied, announcement, copy };
}
