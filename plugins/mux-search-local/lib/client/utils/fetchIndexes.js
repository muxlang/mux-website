import lunr from "lunr";
const EMPTY_RESPONSE = Object.freeze({
    wrappedIndexes: [],
});
export async function fetchIndexes(baseUrl, indexHash = null) {
    const indexUrl = `${baseUrl}search-index.json`;
    const queryString = indexHash ? `?_=${indexHash}` : "";
    let result;
    try {
        result = await fetch(`${indexUrl}${queryString}`);
    }
    catch {
        console.warn(`[docusaurus-plugin-search-local] Unable to fetch search index from ${baseUrl}`);
        return EMPTY_RESPONSE;
    }
    let searchIndexRaw;
    try {
        searchIndexRaw = await result.json();
    }
    catch {
        console.warn(`[docusaurus-plugin-search-local] Unable to parse search index from ${baseUrl}`);
        return EMPTY_RESPONSE;
    }
    const wrappedIndexes = searchIndexRaw.map(({ documents, index }, type) => ({
        type: type,
        documents,
        index: lunr.Index.load(index),
    }));
    return {
        wrappedIndexes,
    };
}
