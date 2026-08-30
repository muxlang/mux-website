import React from 'react';

interface BrowserOnlyProps {
  children?: () => React.ReactNode;
  fallback?: React.ReactNode;
}

const BrowserOnly: React.FC<BrowserOnlyProps> = ({ children, fallback = null }) => {
  const [isBrowser, setIsBrowser] = React.useState(false);

  React.useEffect(() => {
    const hydrationTimer = window.setTimeout(() => setIsBrowser(true), 0);
    return () => window.clearTimeout(hydrationTimer);
  }, []);

  return <>{isBrowser ? children?.() : fallback}</>;
};

export default BrowserOnly;
