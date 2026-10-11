import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    // Docusaurus supplies this module through a Webpack alias at build time.
    // Point Vitest at a minimal browser-test default so hooks can be tested
    // without booting the full Docusaurus client.
    alias: {
      "@site": new URL("./", import.meta.url).pathname,
      "@docusaurus/BrowserOnly": new URL("./test/mocks/BrowserOnly.tsx", import.meta.url).pathname,
      "@docusaurus/router": new URL("./test/mocks/router.ts", import.meta.url).pathname,
      "@docusaurus/useDocusaurusContext": new URL(
        "./test/mocks/useDocusaurusContext.ts",
        import.meta.url,
      ).pathname,
      "@docusaurus/useGlobalData": new URL("./test/mocks/useGlobalData.ts", import.meta.url)
        .pathname,
      "@docusaurus/Link": new URL("./test/mocks/Link.tsx", import.meta.url).pathname,
      "@docusaurus/Head": new URL("./test/mocks/Head.tsx", import.meta.url).pathname,
      "@docusaurus/ExecutionEnvironment": new URL(
        "./test/mocks/ExecutionEnvironment.ts",
        import.meta.url,
      ).pathname,
      "@theme/Layout": new URL("./test/mocks/Layout.tsx", import.meta.url).pathname,
      "@theme-original/Icon/ExternalLink": new URL("./test/mocks/ExternalLink.tsx", import.meta.url)
        .pathname,
      "@docusaurus/useIsBrowser": new URL("./test/mocks/useIsBrowser.ts", import.meta.url).pathname,
      "@docusaurus/theme-common": new URL("./test/mocks/themeCommon.ts", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs", "plugins/**/*.test.{js,jsx}"],
    coverage: {
      include: ["plugins/mux-search-local/lib/**/*.{js,jsx}"],
      exclude: ["**/*.test.{js,jsx}"],
      reportsDirectory: "coverage",
      reporter: ["text", "lcov"],
    },
  },
});
