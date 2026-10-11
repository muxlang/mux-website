import { describe, expect, it } from "vitest";
import { createSearchResultHref } from "./createSearchResultHref";

describe("createSearchResultHref", () => {
  it("links a heading result to its page and fragment", () => {
    expect(createSearchResultHref({ u: "/docs/lsp", h: "#configuration" })).toBe(
      "/docs/lsp#configuration",
    );
  });

  it("links a title result to its page", () => {
    expect(createSearchResultHref({ u: "/docs/lsp" })).toBe("/docs/lsp");
  });
});
