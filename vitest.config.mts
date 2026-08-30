import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Docusaurus supplies this module through a Webpack alias at build time.
    // Point Vitest at a minimal browser-test default so hooks can be tested
    // without booting the full Docusaurus client.
    alias: {
      '@docusaurus/useDocusaurusContext': new URL(
        './test/mocks/useDocusaurusContext.ts',
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
