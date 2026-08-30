import React from 'react';

interface BrowserOnlyProps {
  children: () => React.ReactNode;
  fallback?: React.ReactNode;
}

const BrowserOnly: React.FC<BrowserOnlyProps> = ({ children }) => <>{children()}</>;

export default BrowserOnly;
