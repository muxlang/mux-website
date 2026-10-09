function NoSearchAnalytics() {
    // No search analytics implemnetation found.
}
let cached;
export function _resetCache() {
    cached = undefined;
}
export function SearchAnalyticsFactory() {
    if (!cached) {
        if (typeof _paq !== 'undefined' && _paq && _paq?.push) {
            cached = function searchAnalytics(query, results) {
                _paq.push([
                    'trackSiteSearch',
                    query, // Search keyword searched for
                    false, // Search category selected in your search engine. If you do not need this, set to false
                    (results || []).length, // Number of results on the Search results page. Zero indicates a 'No Result Search Keyword'. Set to false if you don't know
                ]);
            };
        }
        if (typeof gtag !== 'undefined' && typeof gtag === 'function') {
            cached = function searchAnalytics(query) {
                gtag('event', 'search', {
                    search_term: query,
                });
            };
        }
        if (typeof appInsights !== 'undefined') {
            cached = function searchAnalytics(query) {
                appInsights.trackEvent({
                    name: 'search',
                    properties: {
                        search_term: query,
                    },
                });
            };
        }
    }
    return cached || NoSearchAnalytics;
}
