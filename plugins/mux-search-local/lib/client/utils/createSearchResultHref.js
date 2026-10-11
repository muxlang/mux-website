export function createSearchResultHref(document) {
  return `${document.u}${document.h || ""}`;
}
