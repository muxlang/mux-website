import { useCallback, useEffect, useRef, useState } from 'react';

interface CopyFeedback {
  readonly copied: boolean;
  readonly announcement: string;
  readonly copy: () => void;
}

export default function useCopyFeedback(text: string): CopyFeedback {
  const [feedback, setFeedback] = useState({ text, copied: false, copyCount: 0 });
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
          text,
          copied: true,
          copyCount: previous.text === text ? previous.copyCount + 1 : 1,
        }));
        if (resetTimer.current) clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => {
          setFeedback((previous) => (
            previous.text === text ? { ...previous, copied: false } : previous
          ));
          resetTimer.current = null;
        }, 2000);
      })
      .catch(() => {
        // Clipboard write failed, for example in a non-HTTPS context.
      });
  }, [text]);

  const copied = feedback.text === text && feedback.copied;
  let announcement = '';
  if (copied && feedback.copyCount === 1) {
    announcement = 'Copied to clipboard';
  } else if (copied && feedback.copyCount > 1) {
    announcement = 'Copied to clipboard again';
  }

  return { copied, announcement, copy };
}
