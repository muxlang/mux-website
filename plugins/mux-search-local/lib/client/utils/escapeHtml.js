/**
 * Escape html special chars.
 *
 * @param unsafe - A unsafe string.
 *
 * @returns A safe string can be injected as innerHTML.
 */
export function escapeHtml(unsafe) {
  return unsafe
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
