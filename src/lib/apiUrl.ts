// Keep browser traffic on the Cloudflare edge. The Worker proxies compile
// requests to Fly with a private origin token, so the Fly hostname is not a
// public compute entry point.
export const DEFAULT_MUX_API_URL = "https://mux-ai.corniedj.workers.dev";

/**
 * Resolves the base URL for the Mux compile/run API from Docusaurus site
 * config custom fields, falling back to the public API when unset.
 * Shared by useMuxExecutor (which calls the API) and useApiWarmup (which
 * pre-warms it), so both stay in sync on how the URL is resolved.
 *
 * Trailing slashes are stripped so callers can safely append paths like
 * /health or /api/compile without producing double slashes when the
 * configured URL ends in a slash.
 */
export function resolveApiUrl(customFields: Record<string, unknown> | undefined): string {
  let apiUrl = typeof customFields?.apiUrl === "string" ? customFields.apiUrl : DEFAULT_MUX_API_URL;
  while (apiUrl.endsWith("/")) {
    apiUrl = apiUrl.slice(0, -1);
  }
  return apiUrl;
}
