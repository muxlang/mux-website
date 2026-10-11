import lunr from "lunr";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchAnalyticsFactory, _resetCache } from "./SearchAnalyticsFactory";
import { SearchSourceFactory } from "./SearchSourceFactory";
import { escapeHtml } from "./escapeHtml";
import { fetchIndexes } from "./fetchIndexes";
import { getExternalURI } from "./getExternalURI";
import { getStemmedPositions } from "./getStemmedPositions";
import { highlight } from "./highlight";
import { highlightStemmed } from "./highlightStemmed";
import { looseTokenize } from "./looseTokenize";
import { processTreeStatusOfSearchResults } from "./processTreeStatusOfSearchResults";
import { simpleTemplate } from "./simpleTemplate";
import { smartQueries } from "./smartQueries";
import { smartTerms } from "./smartTerms";
import { sortSearchResults } from "./sortSearchResults";
import { tokenize } from "./tokenize";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  _resetCache();
});

describe("search text utilities", () => {
  it("tokenizes, escapes, and templates text safely", () => {
    expect(tokenize("Hello, Mux-lang 世界")).toEqual(["hello,", "mux", "lang", "世界"]);
    expect(looseTokenize("one <two>!")).toEqual(["one", " <", "two", ">!"]);
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#039;");
    expect(simpleTemplate("{{ count }} / {{missing}}", { count: 3 })).toBe("3 / {{missing}}");
  });

  it("highlights matching terms and escapes unmatched content", () => {
    expect(highlight("Mux language", ["mux"])).toBe("<mark>Mux</mark> language");
    expect(highlight("<mux>", ["absent"])).toBe("&lt;mux&gt;");
    expect(highlight("<mux>", [], true)).toBe("<mark>&lt;mux&gt;</mark>");
    expect(highlightStemmed("A Mux language", [[2, 3]], ["mux"])).toContain("<mark>Mux</mark>");
    expect(highlightStemmed("prefix Mux suffix", [[7, 3]], ["mux"], 7)).toMatch(/^…/);
  });

  it("sorts and marks hierarchical search results", () => {
    const title = { document: { i: 1 }, type: 0 };
    const heading = { document: { i: 2 }, type: 1, page: title.document };
    const content = { document: { i: 3 }, type: 2, page: title.document };
    const unrelated = { document: { i: 4 }, type: 0 };
    const results = [heading, content, unrelated, title];
    sortSearchResults(results);
    expect(results.map(({ document }) => document.i)).toEqual([4, 1, 2, 3]);
    processTreeStatusOfSearchResults(results);
    expect(heading.isInterOfTree).toBe(true);
    expect(content.isLastOfTree).toBe(true);
  });

  it("orders stemmed positions and builds safe external URLs", () => {
    expect(
      getStemmedPositions(
        {
          first: {
            t: {
              position: [
                [4, 2],
                [1, 2],
              ],
            },
          },
          second: { t: { position: [[1, 5]] } },
        },
        "t",
      ),
    ).toEqual([
      [1, 5],
      [1, 2],
      [4, 2],
    ]);
    expect(getExternalURI("/docs/guide", "https://example.com/docs/")).toBe(
      "https://example.com/docs/guide",
    );
    expect(getExternalURI("/guide", "https://example.com/")).toBe("https://example.com/guide");
  });

  it("creates smart query alternatives for typing, stop words, and empty input", () => {
    expect(smartTerms(["mux", "lang"])).toEqual([[{ value: "mux" }, { value: "lang" }]]);
    const queries = smartQueries(["the", "mux", "lan"]);
    expect(queries.some(({ tokens }) => tokens.join(" ") === "mux lan")).toBe(true);
    expect(queries.some(({ term }) => term.at(-1).wildcard === lunr.Query.wildcard.TRAILING)).toBe(
      true,
    );
    expect(smartQueries([])).toEqual([]);
  });
});

describe("search index and analytics", () => {
  it("returns an empty index after fetch and JSON failures", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await fetchIndexes("/docs/")).toEqual({ wrappedIndexes: [] });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ json: () => Promise.reject(new Error()) }));
    expect(await fetchIndexes("/docs/")).toEqual({ wrappedIndexes: [] });
    expect(warning).toHaveBeenCalledTimes(2);
  });

  it("loads and queries a serialized Lunr index, then reports analytics", async () => {
    const source = lunr(function () {
      this.ref("i");
      this.field("t");
      this.add({ i: "1", t: "Mux language" });
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => [
          { documents: [{ i: 1, t: "Mux language", u: "/docs" }], index: source.toJSON() },
        ],
      }),
    );
    const { wrappedIndexes } = await fetchIndexes("/", "hash");
    expect(fetch).toHaveBeenCalledWith("/search-index.json?_=hash");
    const onResults = vi.fn();
    const search = SearchSourceFactory({ wrappedIndexes, resultsLimit: 10, onResults });
    const callback = vi.fn();
    search("mux", callback);
    expect(callback.mock.calls[0][0][0].document.t).toBe("Mux language");
    search("---", callback);
    expect(onResults).toHaveBeenCalledTimes(2);
  });

  it("selects available analytics integration once and falls back safely", () => {
    const push = vi.fn();
    vi.stubGlobal("_paq", { push });
    const track = SearchAnalyticsFactory();
    track("mux", [1, 2]);
    expect(push).toHaveBeenCalledWith(["trackSiteSearch", "mux", false, 2]);
    _resetCache();
    vi.stubGlobal("_paq", undefined);
    vi.stubGlobal("gtag", vi.fn());
    SearchAnalyticsFactory()("mux");
    expect(gtag).toHaveBeenCalledWith("event", "search", { search_term: "mux" });
    _resetCache();
    vi.stubGlobal("gtag", undefined);
    expect(() => SearchAnalyticsFactory()("mux")).not.toThrow();
  });
});
