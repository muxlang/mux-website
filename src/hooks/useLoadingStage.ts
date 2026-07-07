import { useEffect, useRef, useState } from 'react';

const COLD_START_DELAY_MS = 3000;

export type LoadingStage = 'running' | 'cold-start';

/**
 * Tracks how long a request has been pending so the UI can switch from a
 * generic "Running..." message to a more informative cold-start notice.
 * The Mux API scales to zero on fly.io, so the first request after idle
 * time can take up to about a minute; without this, "Running..." alone
 * makes the playground look stuck.
 */
function useLoadingStage(loading: boolean): LoadingStage {
  const [stage, setStage] = useState<LoadingStage>('running');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setStage('running');

    if (loading) {
      timerRef.current = setTimeout(() => {
        setStage('cold-start');
      }, COLD_START_DELAY_MS);
    }

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [loading]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return stage;
}

export default useLoadingStage;
