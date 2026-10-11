import { describe, expect, it, vi } from "vitest";
import { loadExternalSearchSources } from "./loadExternalSearchSources";

describe("loadExternalSearchSources", () => {
  const configs = [
    { heading: "First", uri: "/first/" },
    { heading: "Second", uri: "/second/" },
  ];

  it("waits for every index and preserves configured order", async () => {
    const fetchIndexes = vi.fn(async (uri) => {
      await new Promise((resolve) => setTimeout(resolve, uri === "/first/" ? 10 : 0));
      return { wrappedIndexes: [uri] };
    });
    const createSearchSource = vi.fn((indexes) => ({ indexes }));

    const sources = await loadExternalSearchSources(configs, {
      fetchIndexes,
      createSearchSource,
      warn: vi.fn(),
    });

    expect(sources).toEqual([
      { ...configs[0], search: { indexes: ["/first/"] } },
      { ...configs[1], search: { indexes: ["/second/"] } },
    ]);
    expect(fetchIndexes).toHaveBeenCalledTimes(2);
  });

  it("keeps successful sources and warns when an index cannot load", async () => {
    const warn = vi.fn();
    const fetchIndexes = vi.fn(async (uri) => {
      if (uri === "/second/") throw new Error("offline");
      return { wrappedIndexes: ["first-index"] };
    });

    const sources = await loadExternalSearchSources(configs, {
      fetchIndexes,
      createSearchSource: (indexes) => indexes,
      warn,
    });

    expect(sources).toEqual([{ ...configs[0], search: ["first-index"] }]);
    expect(warn).toHaveBeenCalledWith(
      "Unable to fetch search index for Second from: /second/",
      expect.any(Error),
    );
  });
});
