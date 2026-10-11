function NoSearchAnalytics() {
  // No search analytics implemnetation found.
}
let cached;
export function _resetCache() {
  cached = undefined;
}
export function SearchAnalyticsFactory() {
  if (!cached) {
    if (globalThis._paq?.push) {
      cached = function searchAnalytics(query, results) {
        globalThis._paq.push([
          "trackSiteSearch",
          query, // Search keyword searched for
          false, // Search category selected in your search engine. If you do not need this, set to false
          (results || []).length, // Number of results on the Search results page. Zero indicates a 'No Result Search Keyword'. Set to false if you don't know
        ]);
      };
    }
    if (typeof globalThis.gtag === "function") {
      cached = function searchAnalytics(query) {
        globalThis.gtag("event", "search", {
          search_term: query,
        });
      };
    }
    if (globalThis.appInsights) {
      cached = function searchAnalytics(query) {
        globalThis.appInsights.trackEvent({
          name: "search",
          properties: {
            search_term: query,
          },
        });
      };
    }
  }
  return cached || NoSearchAnalytics;
}
