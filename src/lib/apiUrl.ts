export const DEFAULT_MUX_API_URL = 'https://mux-lang-api.fly.dev';

/**
 * Resolves the base URL for the Mux compile/run API from Docusaurus site
 * config custom fields, falling back to the public API when unset.
 * Shared by useMuxExecutor (which calls the API) and useApiWarmup (which
 * pre-warms it), so both stay in sync on how the URL is resolved.
 */
export function resolveApiUrl(customFields: Record<string, unknown> | undefined): string {
  return typeof customFields?.apiUrl === 'string'
    ? customFields.apiUrl
    : DEFAULT_MUX_API_URL;
}
