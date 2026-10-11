/**
 * Load configured external indexes while preserving their configuration order.
 * Failed sources are skipped so one unavailable site cannot disable local search.
 */
export async function loadExternalSearchSources(
  configs,
  { fetchIndexes, createSearchSource, warn = console.warn },
) {
  const sources = await Promise.all(
    configs.map(async (config) => {
      try {
        const { wrappedIndexes } = await fetchIndexes(config.uri);
        return {
          ...config,
          search: createSearchSource(wrappedIndexes),
        };
      } catch (error) {
        warn(`Unable to fetch search index for ${config.heading} from: ${config.uri}`, error);
        return null;
      }
    }),
  );
  return sources.filter(Boolean);
}
